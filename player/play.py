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


def load_playlist() -> dict:
    """
    Carica la regia generata dal director.
    """

    with PLAYLIST_PATH.open(
        "r",
        encoding="utf-8"
    ) as file:
        return json.load(file)


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

    scene = playlist["scenes"][0]

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

    vao = ctx.simple_vertex_array(
        program,
        vertices,
        "in_position"
    )

    events = scene["events"]

    event_index = 0

    # ------------------------------------------------------------
    # Stato iniziale degli uniform.
    # Viene impostato una sola volta prima del rendering.
    # ------------------------------------------------------------

    program["u_resolution"].value = (
        float(width),
        float(height)
    )

    program["u_time"].value = 0.0

    program["u_hitDir"].value = (
        0.0,
        0.0,
        1.0
    )

    program["u_hitStrength"].value = 0.0

    program["u_hitTime"].value = 0.0

    pygame.mixer.music.play()

    running = True

    while running:

        for pygame_event in pygame.event.get():

            if pygame_event.type == pygame.QUIT:
                running = False

            if (
                pygame_event.type == pygame.KEYDOWN
                and
                pygame_event.key == pygame.K_ESCAPE
            ):
                running = False

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

        #
        # Cerca gli eventi che sono diventati
        # attivi dall'ultimo frame.
        #
        while (
            event_index < len(events)
            and
            events[event_index]["time"]
            <= current_time
        ):

            event = events[event_index]

            uniforms = event["uniforms"]

            program["u_hitDir"].value = tuple(
                uniforms["u_hitDir"]
            )

            program["u_hitStrength"].value = (
                uniforms["u_hitStrength"]
            )

            program["u_hitTime"].value = (
                event["time"]
            )

            print(
                f"{current_time:7.3f}s"
                f" -> HIT "
                f"{uniforms['u_hitStrength']:.3f}"
            )

            event_index += 1

        program["u_resolution"].value = (
            float(width),
            float(height)
        )

        program["u_time"].value = current_time

        ctx.clear(
            0.0,
            0.0,
            0.0
        )

        vao.render()

        pygame.display.flip()

    pygame.mixer.music.stop()
    pygame.quit()

if __name__ == "__main__":
    main()