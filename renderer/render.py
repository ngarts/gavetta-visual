import json
import math
import shutil
import subprocess
import sys
import time
from array import array
from pathlib import Path

import moderngl
import pygame


# ============================================================
# PATH
# ============================================================

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

OUTPUT_DIR = (
    ROOT_DIR /
    "output"
)

OUTPUT_PATH = (
    OUTPUT_DIR /
    "gavetta-youtube-1080p60.mp4"
)


# ============================================================
# OUTPUT YOUTUBE
# ============================================================

WIDTH = 1920
HEIGHT = 1080
FPS = 60

# H.264 CRF:
# 16 = master molto pulito per l'upload YouTube.
# Valori più bassi = qualità maggiore / file più grande.
VIDEO_CRF = 16

# "slow" comprime meglio di "medium", ma richiede più CPU.
VIDEO_PRESET = "slow"

AUDIO_BITRATE = "320k"


# ============================================================
# VERTEX SHADER
# ============================================================

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


# ============================================================
# PLAYLIST
# ============================================================

def load_playlist() -> dict:
    """
    Carica la regia generata dal Director.
    """

    with PLAYLIST_PATH.open(
        "r",
        encoding="utf-8"
    ) as file:
        return json.load(file)


# ============================================================
# UNIFORM
# ============================================================

def set_uniform(
    program,
    name: str,
    value
):
    """
    Imposta un uniform soltanto se esiste nello shader corrente.

    Shader diversi possono quindi esporre uniform diversi senza
    richiedere logica specifica nel renderer.
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
    Inizializza gli uniform comuni e quelli eventualmente
    utilizzati dai vari shader.
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

    # Impact sphere
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

    # Shader audio-reactive generici
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


# ============================================================
# SHADER / SCENA
# ============================================================

def create_scene_renderer(
    ctx,
    vertices,
    scene: dict,
    width: int,
    height: int,
    current_time: float
):
    """
    Compila lo shader associato alla scena, costruisce il VAO
    e carica l'eventuale texture dichiarata nella playlist.
    """

    shader_path = (
        SHADERS_DIR /
        scene["shader"]
    )

    if not shader_path.exists():
        raise FileNotFoundError(
            f"Shader non trovato: {shader_path}"
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

    # --------------------------------------------------------
    # Texture opzionale
    # --------------------------------------------------------

    texture = None

    texture_name = scene.get(
        "texture"
    )

    if texture_name is not None:

        texture_path = (
            ROOT_DIR /
            texture_name
        )

        if not texture_path.exists():
            raise FileNotFoundError(
                f"Texture non trovata: {texture_path}"
            )

        image = pygame.image.load(
            str(texture_path)
        ).convert_alpha()

        # Stessa convenzione del Player:
        # pygame e OpenGL hanno origine verticale opposta.
        image = pygame.transform.flip(
            image,
            False,
            True
        )

        image_data = pygame.image.tostring(
            image,
            "RGBA",
            False
        )

        texture = ctx.texture(
            image.get_size(),
            4,
            image_data
        )

        texture.filter = (
            moderngl.LINEAR,
            moderngl.LINEAR
        )

        texture.repeat_x = False
        texture.repeat_y = False

        texture.use(
            location=0
        )

        set_uniform(
            program,
            "u_texture",
            0
        )

    return program, vao, texture


def release_scene_renderer(
    program,
    vao,
    texture
):
    """
    Rilascia soltanto le risorse appartenenti alla scena corrente.
    """

    if texture is not None:
        texture.release()

    vao.release()
    program.release()


# ============================================================
# EVENTI VISUALI
# ============================================================

def apply_visual_event(
    program,
    event: dict
):
    """
    Applica alla GPU un evento già deciso dal Director.

    Il tempo dell'evento rimane quello assoluto della playlist:
    anche nel rendering offline il decadimento degli shader è quindi
    identico a quello del Player realtime.
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

    # Impact sphere
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

    # Shader audio-reactive generici
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


# ============================================================
# FFMPEG
# ============================================================

def find_ffmpeg() -> str:
    """
    Cerca ffmpeg nel PATH.
    """

    ffmpeg = shutil.which("ffmpeg")

    if ffmpeg is None:
        raise RuntimeError(
            "FFmpeg non trovato nel PATH.\n"
            "Installa FFmpeg e verifica che il comando 'ffmpeg -version' "
            "funzioni dal terminale."
        )

    return ffmpeg


def start_ffmpeg(
    audio_path: Path,
    output_path: Path
):
    """
    Avvia FFmpeg e prepara stdin per ricevere frame RGB24.

    OpenGL restituisce il framebuffer dal basso verso l'alto;
    il filtro vflip ripristina l'orientamento corretto per il video.
    """

    ffmpeg = find_ffmpeg()

    command = [
        ffmpeg,
        "-y",

        # Video raw proveniente da Python
        "-f", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s:v", f"{WIDTH}x{HEIGHT}",
        "-r", str(FPS),
        "-i", "-",

        # Master audio originale
        "-i", str(audio_path),

        # Stream selection
        "-map", "0:v:0",
        "-map", "1:a:0",

        # Correzione orientamento framebuffer OpenGL
        "-vf", "vflip",

        # Video YouTube
        "-c:v", "libx264",
        "-preset", VIDEO_PRESET,
        "-crf", str(VIDEO_CRF),
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level:v", "4.2",

        # Audio
        "-c:a", "aac",
        "-b:a", AUDIO_BITRATE,
        "-ar", "48000",
        "-ac", "2",

        # Compatibilità web
        "-movflags", "+faststart",

        # Il video e il master hanno la stessa durata, ma questa
        # protezione impedisce eventuali code indesiderate.
        "-shortest",

        str(output_path)
    ]

    print("FFmpeg:")
    print(" ".join(f'"{item}"' if " " in item else item for item in command))
    print()

    return subprocess.Popen(
        command,
        stdin=subprocess.PIPE
    )


# ============================================================
# PROGRESSO
# ============================================================

def format_duration(seconds: float) -> str:
    seconds = max(0, int(round(seconds)))
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)

    if hours:
        return f"{hours:d}:{minutes:02d}:{seconds:02d}"

    return f"{minutes:02d}:{seconds:02d}"


def print_progress(
    frame_index: int,
    total_frames: int,
    started_at: float
):
    """
    Mostra avanzamento, velocità effettiva ed ETA.
    """

    elapsed = time.perf_counter() - started_at
    completed = frame_index + 1

    render_fps = (
        completed / elapsed
        if elapsed > 0.0
        else 0.0
    )

    remaining_frames = (
        total_frames - completed
    )

    eta = (
        remaining_frames / render_fps
        if render_fps > 0.0
        else 0.0
    )

    percent = (
        100.0 *
        completed /
        total_frames
    )

    print(
        f"\r"
        f"{percent:6.2f}%  "
        f"{completed:5d}/{total_frames} frame  "
        f"{render_fps:5.2f} fps render  "
        f"ETA {format_duration(eta)}",
        end="",
        flush=True
    )


# ============================================================
# MAIN
# ============================================================

def main():

    pygame.init()

    # --------------------------------------------------------
    # Contesto OpenGL
    #
    # Riutilizziamo la stessa strada del Player, che sappiamo
    # funzionare sulla macchina. La finestra serve soltanto a
    # creare il contesto: i frame definitivi vengono prodotti
    # in un framebuffer OFFSCREEN a 1920x1080.
    # --------------------------------------------------------

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

    pygame.display.set_caption(
        "Gavetta - Offline Renderer"
    )

    # Non è necessario che la finestra abbia le dimensioni
    # del master finale: renderizziamo in un FBO indipendente.
    pygame.display.set_mode(
        (640, 360),
        pygame.OPENGL |
        pygame.DOUBLEBUF
    )

    ctx = moderngl.create_context()

    # --------------------------------------------------------
    # Playlist / audio
    # --------------------------------------------------------

    playlist = load_playlist()

    scenes = playlist["scenes"]

    if not scenes:
        raise RuntimeError(
            "La playlist non contiene scene."
        )

    duration = float(
        playlist["duration"]
    )

    audio_path = (
        AUDIO_DIR /
        playlist["audio"]
    )

    if not audio_path.exists():
        raise FileNotFoundError(
            f"Master audio non trovato: {audio_path}"
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Full-screen quad
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
    # Framebuffer OFFSCREEN 1920x1080
    # --------------------------------------------------------

    color_texture = ctx.texture(
        (WIDTH, HEIGHT),
        components=3,
        dtype="f1"
    )

    color_texture.filter = (
        moderngl.NEAREST,
        moderngl.NEAREST
    )

    framebuffer = ctx.framebuffer(
        color_attachments=[
            color_texture
        ]
    )

    framebuffer.use()

    ctx.viewport = (
        0,
        0,
        WIDTH,
        HEIGHT
    )

    # --------------------------------------------------------
    # Prima scena
    # --------------------------------------------------------

    scene_index = 0
    scene = scenes[scene_index]

    program, vao, texture = create_scene_renderer(
        ctx,
        vertices,
        scene,
        WIDTH,
        HEIGHT,
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
    # Numero frame
    #
    # 192 s * 60 fps = 11520 frame per Gavetta.
    # Ogni frame usa il tempo matematico frame_index / FPS:
    # nessun clock realtime e nessuna deriva.
    # --------------------------------------------------------

    total_frames = int(
        round(
            duration * FPS
        )
    )

    print()
    print(
        f"Rendering: {WIDTH}x{HEIGHT} @ {FPS} fps"
    )
    print(
        f"Durata: {duration:.3f} s"
    )
    print(
        f"Frame totali: {total_frames}"
    )
    print(
        f"Output: {OUTPUT_PATH}"
    )
    print()

    ffmpeg_process = start_ffmpeg(
        audio_path,
        OUTPUT_PATH
    )

    if ffmpeg_process.stdin is None:
        raise RuntimeError(
            "Impossibile aprire stdin di FFmpeg."
        )

    started_at = time.perf_counter()

    try:

        for frame_index in range(total_frames):

            # ------------------------------------------------
            # Tempo assoluto deterministico
            # ------------------------------------------------

            current_time = (
                frame_index /
                float(FPS)
            )

            # ------------------------------------------------
            # Manteniamo viva la finestra OpenGL.
            # Non influenza in alcun modo il tempo del video.
            # ------------------------------------------------

            for pygame_event in pygame.event.get():
                if pygame_event.type == pygame.QUIT:
                    raise KeyboardInterrupt

                if (
                    pygame_event.type == pygame.KEYDOWN
                    and
                    pygame_event.key == pygame.K_ESCAPE
                ):
                    raise KeyboardInterrupt

            # ------------------------------------------------
            # Cambio scena
            # ------------------------------------------------

            while (
                scene_index < len(scenes) - 1
                and
                current_time >= scene["end"]
            ):

                release_scene_renderer(
                    program,
                    vao,
                    texture
                )

                scene_index += 1
                scene = scenes[scene_index]

                program, vao, texture = create_scene_renderer(
                    ctx,
                    vertices,
                    scene,
                    WIDTH,
                    HEIGHT,
                    current_time
                )

                events = scene["events"]
                event_index = 0

                print()
                print()
                print(
                    f"SCENE {scene_index + 1}: "
                    f"{scene['shader']} "
                    f"({scene['start']:.3f}s -> "
                    f"{scene['end']:.3f}s)"
                )

            # ------------------------------------------------
            # Eventi musicali già decisi dal Director
            # ------------------------------------------------

            while (
                event_index < len(events)
                and
                events[event_index]["time"]
                <= current_time
            ):

                apply_visual_event(
                    program,
                    events[event_index]
                )

                event_index += 1

            # ------------------------------------------------
            # Uniform aggiornati ogni frame
            # ------------------------------------------------

            set_uniform(
                program,
                "u_resolution",
                (
                    float(WIDTH),
                    float(HEIGHT)
                )
            )

            set_uniform(
                program,
                "u_time",
                current_time
            )

            # Se esiste una texture, ribadiamo la texture unit.
            # È economico e rende il cambio scena robusto.
            if texture is not None:
                texture.use(
                    location=0
                )

            # ------------------------------------------------
            # Rendering GPU OFFSCREEN
            # ------------------------------------------------

            framebuffer.use()

            ctx.viewport = (
                0,
                0,
                WIDTH,
                HEIGHT
            )

            ctx.clear(
                0.0,
                0.0,
                0.0
            )

            vao.render(
                mode=moderngl.TRIANGLES
            )

            # RGB24, una riga dopo l'altra.
            frame_bytes = framebuffer.read(
                components=3,
                alignment=1
            )

            # ------------------------------------------------
            # Stream diretto verso FFmpeg
            # ------------------------------------------------

            try:
                ffmpeg_process.stdin.write(
                    frame_bytes
                )
            except BrokenPipeError as exc:
                raise RuntimeError(
                    "FFmpeg ha interrotto la pipe durante il rendering."
                ) from exc

            # Aggiorniamo il progresso una volta al secondo
            # di video e all'ultimo frame.
            if (
                frame_index % FPS == 0
                or
                frame_index == total_frames - 1
            ):
                print_progress(
                    frame_index,
                    total_frames,
                    started_at
                )

        print()

        ffmpeg_process.stdin.close()

        return_code = ffmpeg_process.wait()

        if return_code != 0:
            raise RuntimeError(
                f"FFmpeg è terminato con codice {return_code}."
            )

        elapsed = (
            time.perf_counter()
            -
            started_at
        )

        print()
        print("Rendering completato.")
        print(
            f"Tempo impiegato: "
            f"{format_duration(elapsed)}"
        )
        print(
            f"File finale: "
            f"{OUTPUT_PATH}"
        )

    except KeyboardInterrupt:

        print()
        print()
        print("Rendering interrotto dall'utente.")

        try:
            ffmpeg_process.stdin.close()
        except Exception:
            pass

        ffmpeg_process.terminate()
        ffmpeg_process.wait()

        # Evitiamo di lasciare un MP4 incompleto che possa
        # essere scambiato per il master definitivo.
        if OUTPUT_PATH.exists():
            try:
                OUTPUT_PATH.unlink()
            except OSError:
                pass

    finally:

        release_scene_renderer(
            program,
            vao,
            texture
        )

        framebuffer.release()
        color_texture.release()
        vertices.release()

        pygame.quit()


if __name__ == "__main__":
    main()
