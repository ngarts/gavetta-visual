import json
from array import array
from pathlib import Path

import moderngl
import pygame


ROOT_DIR = Path(__file__).resolve().parent.parent

PLAYLIST_PATH = (
    ROOT_DIR /
    "data" /
    "gavetta-playlist.json"
)

SHADERS_DIR = (
    ROOT_DIR /
    "shaders"
)

AUDIO_DIR = (
    ROOT_DIR /
    "audio"
)


VERTEX_SHADER = """
#version 330

in vec2 in_position;

void main()
{
    gl_Position = vec4(
        in_position,
        0.0,
        1.0
    );
}
"""


# ------------------------------------------------------------
# Playlist
# ------------------------------------------------------------

def load_playlist() -> dict:
    """
    Carica la regia generata dal director.
    """

    with PLAYLIST_PATH.open(
        "r",
        encoding="utf-8"
    ) as file:
        return json.load(file)


# ------------------------------------------------------------
# Uniform
# ------------------------------------------------------------

def set_uniform(
    program,
    name: str,
    value
):
    """
    Imposta un uniform soltanto se esiste
    nello shader corrente.

    In questo modo shader diversi possono
    esporre uniform diversi.
    """

    if name in program:
        program[name].value = value


def initialize_program(
    program,
    width: int,
    height: int,
    current_time: float
):
    """
    Inizializza gli uniform comuni e quelli
    eventualmente usati dagli shader.
    """

    set_uniform(
        program,
        "u_resolution",
        (
            float(width),
            float(height)
        )
    )

    set_uniform(
        program,
        "u_time",
        current_time
    )

    # --------------------------------------------------------
    # Impact sphere
    # --------------------------------------------------------

    set_uniform(
        program,
        "u_hitDir",
        (
            0.0,
            0.0,
            1.0
        )
    )

    set_uniform(
        program,
        "u_hitStrength",
        0.0
    )

    set_uniform(
        program,
        "u_hitTime",
        current_time
    )

    # --------------------------------------------------------
    # Shader audio-reactive generici
    # --------------------------------------------------------

    set_uniform(
        program,
        "u_eventStrength",
        0.0
    )

    set_uniform(
        program,
        "u_eventTime",
        current_time
    )


# ------------------------------------------------------------
# Shader / scena
# ------------------------------------------------------------

def create_scene_renderer(
    ctx,
    vertices,
    scene: dict,
    width: int,
    height: int,
    current_time: float
):
    """
    Compila lo shader associato alla scena
    e costruisce il relativo VAO.
    """

    shader_path = (
        SHADERS_DIR /
        scene["shader"]
    )

    fragment_shader = shader_path.read_text(
        encoding="utf-8"
    )

    program = ctx.program(
        vertex_shader=VERTEX_SHADER,
        fragment_shader=fragment_shader
    )

    vao = ctx.simple_vertex_array(
        program,
        vertices,
        "in_position"
    )

    initialize_program(
        program,
        width,
        height,
        current_time
    )

    return program, vao


# ------------------------------------------------------------
# Evento visuale
# ------------------------------------------------------------

def apply_visual_event(
    program,
    event: dict,
    current_time: float
):
    """
    Traduce l'evento della playlist negli
    uniform riconosciuti dallo shader corrente.

    Lo stesso evento può quindi essere interpretato:

    - dalla sfera come colpo;
    - dal tunnel come impulso di glow.
    """

    uniforms = event["uniforms"]

    hit_direction = tuple(
        uniforms["u_hitDir"]
    )

    hit_strength = (
        uniforms["u_hitStrength"]
    )

    event_time = (
        event["time"]
    )

    # --------------------------------------------------------
    # Impact sphere
    # --------------------------------------------------------

    set_uniform(
        program,
        "u_hitDir",
        hit_direction
    )

    set_uniform(
        program,
        "u_hitStrength",
        hit_strength
    )

    set_uniform(
        program,
        "u_hitTime",
        event_time
    )

    # --------------------------------------------------------
    # Triangle tunnel / altri shader futuri
    # --------------------------------------------------------

    set_uniform(
        program,
        "u_eventStrength",
        hit_strength
    )

    set_uniform(
        program,
        "u_eventTime",
        event_time
    )

    print(
        f"{current_time:7.3f}s"
        f" -> EVENT "
        f"{hit_strength:.3f}"
    )


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

def main():

    pygame.init()

    width = 1280
    height = 720

    pygame.display.gl_set_attribute(
        pygame.GL_CONTEXT_MAJOR_VERSION,
        3
    )

    pygame.display.gl_set_attribute(
        pygame.GL_CONTEXT_MINOR_VERSION,
        3
    )

    pygame.display.gl_set_attribute(
        pygame.GL_CONTEXT_PROFILE_MASK,
        pygame.GL_CONTEXT_PROFILE_CORE
    )

    pygame.display.set_mode(
        (width, height),
        pygame.OPENGL |
        pygame.DOUBLEBUF
    )

    ctx = moderngl.create_context()

    playlist = load_playlist()

    scenes = playlist["scenes"]

    if not scenes:
        raise RuntimeError(
            "La playlist non contiene scene."
        )

    # --------------------------------------------------------
    # Audio
    # --------------------------------------------------------

    audio_path = (
        AUDIO_DIR /
        playlist["audio"]
    )

    pygame.mixer.init(
        frequency=48000
    )

    pygame.mixer.music.load(
        str(audio_path)
    )

    # --------------------------------------------------------
    # Full-screen quad
    #
    # Il buffer è comune a tutti gli shader.
    # Non dobbiamo ricrearlo a ogni cambio scena.
    # --------------------------------------------------------

    vertices = ctx.buffer(
        array(
            "f",
            [
                -1.0, -1.0,
                 1.0, -1.0,
                -1.0,  1.0,

                -1.0,  1.0,
                 1.0, -1.0,
                 1.0,  1.0,
            ]
        )
    )

    # --------------------------------------------------------
    # Prima scena
    # --------------------------------------------------------

    scene_index = 0

    scene = scenes[scene_index]

    program, vao = create_scene_renderer(
        ctx,
        vertices,
        scene,
        width,
        height,
        0.0
    )

    events = scene["events"]

    event_index = 0

    print(
        f"SCENE {scene_index + 1}: "
        f"{scene['shader']} "
        f"({scene['start']:.3f}s -> "
        f"{scene['end']:.3f}s)"
    )

    # --------------------------------------------------------
    # Start audio
    # --------------------------------------------------------

    pygame.mixer.music.play()

    running = True

    while running:

        # ----------------------------------------------------
        # Eventi pygame
        # ----------------------------------------------------

        for pygame_event in pygame.event.get():

            if pygame_event.type == pygame.QUIT:
                running = False

            if (
                pygame_event.type == pygame.KEYDOWN
                and
                pygame_event.key == pygame.K_ESCAPE
            ):
                running = False

        # ----------------------------------------------------
        # Clock audio
        # ----------------------------------------------------

        audio_position_ms = (
            pygame.mixer.music.get_pos()
        )

        if audio_position_ms < 0:
            running = False
            continue

        current_time = (
            audio_position_ms /
            1000.0
        )

        # ----------------------------------------------------
        # Cambio scena
        #
        # L'audio NON viene toccato.
        #
        # Cambiamo soltanto:
        #
        # program
        # vao
        # lista eventi
        #
        # u_time continua invece a essere il tempo assoluto
        # del brano.
        # ----------------------------------------------------

        while (
            scene_index < len(scenes) - 1
            and
            current_time >= scene["end"]
        ):

            # Rilasciamo le risorse legate
            # al vecchio shader.
            vao.release()
            program.release()

            scene_index += 1

            scene = scenes[scene_index]

            program, vao = create_scene_renderer(
                ctx,
                vertices,
                scene,
                width,
                height,
                current_time
            )

            events = scene["events"]

            event_index = 0

            print()
            print(
                f"SCENE {scene_index + 1}: "
                f"{scene['shader']} "
                f"({scene['start']:.3f}s -> "
                f"{scene['end']:.3f}s)"
            )

        # ----------------------------------------------------
        # Eventi audio della scena corrente
        # ----------------------------------------------------

        while (
            event_index < len(events)
            and
            events[event_index]["time"]
            <= current_time
        ):

            event = events[event_index]

            apply_visual_event(
                program,
                event,
                current_time
            )

            event_index += 1

        # ----------------------------------------------------
        # Uniform aggiornati ogni frame
        # ----------------------------------------------------

        set_uniform(
            program,
            "u_resolution",
            (
                float(width),
                float(height)
            )
        )

        set_uniform(
            program,
            "u_time",
            current_time
        )

        # ----------------------------------------------------
        # Rendering
        # ----------------------------------------------------

        ctx.clear(
            0.0,
            0.0,
            0.0
        )

        vao.render()

        pygame.display.flip()

    # --------------------------------------------------------
    # Cleanup
    # --------------------------------------------------------

    pygame.mixer.music.stop()

    vao.release()
    program.release()
    vertices.release()

    pygame.quit()


if __name__ == "__main__":
    main()