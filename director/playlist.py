import json
from pathlib import Path

from events import detect_events
from mappings import (
    map_bands_to_hit_direction,
    map_event_to_hit_strength
)


ROOT_DIR = Path(__file__).resolve().parent.parent

ANALYSIS_PATH = (
    ROOT_DIR /
    "data" /
    "gavetta-analysis.json"
)

PLAYLIST_PATH = (
    ROOT_DIR /
    "data" /
    "gavetta-playlist.json"
)


# ------------------------------------------------------------
# Regole di regia
# ------------------------------------------------------------

MIN_SCENE_DURATION = 10.0
MAX_SCENE_DURATION = 30.0

# Apertura artistica: vogliamo entrare nel brano attraverso il tunnel.
OPENING_SHADER = "triangle-tunnel.frag"

# Entro questo istante tutti i linguaggi visivi devono essere già comparsi.
EARLY_COVERAGE_END = 100.0

# Piccolo malus per evitare ritorni troppo ravvicinati allo stesso shader.
# Non è un divieto: A -> B -> A resta possibile se la musica lo giustifica.
RECENCY_PENALTY_NEAR = 0.82
RECENCY_PENALTY_MEDIUM = 0.92

# Durante la fase iniziale di copertura, gli shader ancora mai usati
# ricevono un piccolo vantaggio, così il Director non aspetta l'ultimo
# momento utile per presentarli.
EARLY_MISSING_BOOST = 1.18

# Shader disponibili per la regia.
#
# Tutti devono apparire almeno una volta nel brano; la scelta
# delle finestre resta però deterministica e guidata dai dati audio.
SHADERS = [
    "impact-sphere.frag",
    "triangle-tunnel.frag",
    "infinity-glass.frag",
    "fragments.frag",
    "matrix.frag",
    "saturn.frag",
    "wanderer-fog.frag",
    "fractal-nebula.frag"
]

SHADER_TEXTURES = {
    "wanderer-fog.frag": "images/wanderer-fog.png"
}

# ------------------------------------------------------------
# Utility
# ------------------------------------------------------------

def percentile(values: list, q: float) -> float:
    """
    Percentile semplice senza dipendenze esterne.

    q deve essere compreso tra 0 e 1.
    """

    if not values:
        return 0.0

    ordered = sorted(values)

    index = int(
        round(
            q * (len(ordered) - 1)
        )
    )

    return ordered[index]


def get_song_duration(
    metadata: dict,
    frames: list
) -> float:
    """
    Recupera la durata del brano senza dipendere da un solo
    nome di campo del metadata.
    """

    for key in (
        "durationSeconds",
        "duration",
        "audioDuration"
    ):
        if key in metadata:
            return float(metadata[key])

    if not frames:
        return 0.0

    duration = float(frames[-1]["time"])

    # Se abbiamo hop e sample rate, aggiungiamo la durata
    # dell'ultimo passo di analisi per avvicinarci alla fine reale.
    sample_rate = metadata.get("sampleRate")
    hop_size = metadata.get("hopSize")

    if sample_rate and hop_size:
        duration += (
            float(hop_size) /
            float(sample_rate)
        )

    return duration


def build_scene_windows(
    duration: float
) -> list:
    """
    Divide il brano in finestre-base da MIN_SCENE_DURATION.

    Le finestre sono punti nei quali il director PUO' cambiare shader.
    Se alla fine resta una coda più corta del minimo, viene assorbita
    dalla finestra precedente.

    La durata massima effettiva di una scena viene invece garantita
    durante la selezione dello shader.
    """

    if duration <= 0.0:
        return []

    if duration <= MIN_SCENE_DURATION:
        return [
            {
                "start": 0.0,
                "end": duration
            }
        ]

    windows = []
    start = 0.0

    while (
        duration - start >=
        2.0 * MIN_SCENE_DURATION
    ):
        end = start + MIN_SCENE_DURATION

        windows.append({
            "start": start,
            "end": end
        })

        start = end

    # L'ultima finestra assorbe ciò che resta.
    # In questo modo non produciamo una scena finale < MIN.
    windows.append({
        "start": start,
        "end": duration
    })

    return windows


def frames_in_window(
    frames: list,
    start: float,
    end: float
) -> list:
    """
    Restituisce i frame appartenenti alla finestra temporale.
    """

    return [
        frame
        for frame in frames
        if (
            frame["time"] >= start
            and
            frame["time"] < end
        )
    ]


def compute_window_features(
    frames: list,
    attack_reference: float,
    spectral_flux_reference: float,
    rms_reference: float
) -> dict:
    """
    Riassume il comportamento musicale di una finestra.

    - transientP90: quanto sono forti i picchi rapidi;
    - transientMean: attività media di attack + spectral flux;
    - sustainedRms: energia media sostenuta.

    Sono misure descrittive. La scelta artistica avviene dopo,
    in score_shader().
    """

    if not frames:
        return {
            "transientP90": 0.0,
            "transientMean": 0.0,
            "sustainedRms": 0.0
        }

    transient_values = []
    rms_values = []

    for frame in frames:
        attack = (
            frame["attack"] /
            attack_reference
        )

        spectral_flux = (
            frame["spectralFlux"] /
            spectral_flux_reference
        )

        transient = (
            0.6 * attack +
            0.4 * spectral_flux
        )

        transient_values.append(
            transient
        )

        if rms_reference > 0.0:
            rms_values.append(
                frame["rms"] /
                rms_reference
            )
        else:
            rms_values.append(0.0)

    return {
        "transientP90": percentile(
            transient_values,
            0.90
        ),
        "transientMean": (
            sum(transient_values) /
            len(transient_values)
        ),
        "sustainedRms": (
            sum(rms_values) /
            len(rms_values)
        )
    }


def score_shader(
    shader: str,
    features: dict
) -> float:
    """
    Traduce le caratteristiche musicali della finestra
    in affinità con ciascun linguaggio visivo.

    La sfera preferisce sezioni con picchi/attacchi marcati.
    Il tunnel preferisce energia più continua e sostenuta.
    L'infinito preferisce sezioni più controllate e meno affollate.
    I frammenti preferiscono attività transiente diffusa.
    Matrix preferisce densità + energia sostenuta.
    Saturno preferisce respiro, con transienti controllati e presenza sonora.
    Il viandante preferisce sezioni ampie e contemplative.
    La nebula frattale preferisce energia continua con attività transiente distribuita.

    Nota importante:
    - transientP90 premia i PICCHI forti;
    - transientMean premia quanto una finestra è complessivamente
      "affollata" di attività rapida;
    - sustainedRms descrive l'energia media sostenuta.
    """

    if shader == "impact-sphere.frag":
        return (
            0.75 * features["transientP90"] +
            0.25 * features["transientMean"]
        )

    if shader == "triangle-tunnel.frag":
        return (
            0.85 * features["sustainedRms"] +
            0.15 * features["transientMean"]
        )

    if shader == "infinity-glass.frag":
        # L'infinito di vetro funziona bene quando la musica lascia spazio:
        # penalizziamo sia i transienti forti sia l'affollamento medio.
        #
        # La forma 1 / (1 + x) mantiene lo score positivo e stabile
        # anche quando i valori normalizzati superano 1.
        activity = (
            0.50 * features["transientP90"] +
            0.30 * features["transientMean"] +
            0.20 * features["sustainedRms"]
        )

        return (
            1.0 /
            (1.0 + activity)
        )

    if shader == "fragments.frag":
        # I frammenti rendono meglio con molti transienti distribuiti:
        # transientMean pesa più del singolo picco dominante.
        return (
            0.62 * features["transientMean"] +
            0.28 * features["transientP90"] +
            0.10 * features["sustainedRms"]
        )

    if shader == "matrix.frag":
        # Matrix preferisce sezioni dense ed energetiche, nelle quali
        # attività rapida ed energia sostenuta convivono. Rispetto ai
        # fragments, diamo quindi molto più peso all'RMS sostenuto.
        return (
            0.45 * features["transientMean"] +
            0.15 * features["transientP90"] +
            0.40 * features["sustainedRms"]
        )

    if shader == "saturn.frag":
        # Saturno è il visual più ampio e contemplativo: preferisce
        # transienti relativamente controllati, ma non necessariamente
        # sezioni deboli. Una buona energia sostenuta lo aiuta.
        transient_calm = (
            1.0 /
            (
                1.0 +
                0.65 * features["transientP90"] +
                0.35 * features["transientMean"]
            )
        )

        sustained_presence = (
            features["sustainedRms"] /
            (1.0 + features["sustainedRms"])
        )

        return (
            0.60 * transient_calm +
            0.40 * sustained_presence
        )

    if shader == "wanderer-fog.frag":
        # Il viandante funziona meglio nelle sezioni ampie e contemplative:
        # pochi transienti aggressivi, ma sufficiente energia sostenuta
        # perché la nebbia possa respirare e reagire agli eventi.

        transient_calm = (
            1.0 /
            (
                1.0 +
                0.75 * features["transientP90"] +
                0.25 * features["transientMean"]
            )
        )

        sustained_presence = (
            features["sustainedRms"] /
            (1.0 + features["sustainedRms"])
        )

        return (
            0.70 * transient_calm +
            0.30 * sustained_presence
        )

    if shader == "fractal-nebula.frag":
        # La nebula frattale rende meglio quando la musica combina
        # attività transiente diffusa ed energia sostenuta.
        #
        # A differenza della sfera non cerca il singolo colpo dominante;
        # a differenza di Matrix non privilegia soltanto la densità.
        # Cerchiamo sezioni musicalmente vive e continue, nelle quali
        # filamenti e bordi possano reagire senza diventare frenetici.
        return (
            0.50 * features["transientMean"] +
            0.20 * features["transientP90"] +
            0.30 * features["sustainedRms"]
        )

    raise ValueError(
        f"Nessuno score definito per lo shader: {shader}"
    )


# ------------------------------------------------------------
# Eventi visuali
# ------------------------------------------------------------

def build_visual_event(
    event: dict
) -> dict:
    """
    Costruisce un evento comune alla playlist.

    La sfera interpreta u_hitStrength come forza del colpo.
    Il tunnel può riutilizzare lo stesso valore come intensità
    del glow tramite il player.
    """

    hit_direction = map_bands_to_hit_direction(
        event["bands"]
    )

    hit_strength = map_event_to_hit_strength(
        event["strength"]
    )

    return {
        "time": event["time"],

        "uniforms": {
            "u_hitDir": hit_direction,
            "u_hitStrength": hit_strength
        },

        "source": {
            "strength": event["strength"],
            "attack": event["attack"],
            "spectralFlux": event["spectralFlux"],
            "spectralCentroid":
                event["spectralCentroid"],
            "spectralSpread":
                event["spectralSpread"],
            "bands": event["bands"]
        }
    }


def events_in_window(
    visual_events: list,
    start: float,
    end: float
) -> list:
    """
    Assegna alla scena soltanto gli eventi che cadono
    nel suo intervallo temporale.
    """

    return [
        event
        for event in visual_events
        if (
            event["time"] >= start
            and
            event["time"] < end
        )
    ]


# ------------------------------------------------------------
# Scelta delle scene
# ------------------------------------------------------------

def select_shader_for_window(
    scores: dict,
    used_shaders: set,
    usage_windows: dict,
    windows_left: int,
    current_shader: str | None,
    current_scene_duration: float,
    window_duration: float,
    window_index: int,
    window_start: float,
    coverage_windows_left: int,
    last_used_window: dict
) -> str:
    """
    Sceglie lo shader rispettando cinque principi di regia:

    1. la prima finestra usa OPENING_SHADER;
    2. tutti gli shader devono essere comparsi entro EARLY_COVERAGE_END;
    3. la durata massima di una scena resta MAX_SCENE_DURATION;
    4. i ritorni troppo ravvicinati ricevono un piccolo malus;
    5. gli shader già molto usati accumulano una fatica visiva;
    6. dopo la copertura iniziale la musica torna a decidere liberamente.

    Il recency penalty non vieta A -> B -> A: rende soltanto meno pigro
    il Director quando due shader tendono a dominare numericamente.

    La fatica visiva non impone quote e non vieta nessuno shader:
    riduce progressivamente il vantaggio di quelli già molto presenti,
    lasciando comunque alla musica la possibilità di richiamarli.
    """

    # --------------------------------------------------------
    # Apertura artistica
    # --------------------------------------------------------
    if window_index == 0:
        return OPENING_SHADER

    missing_shaders = [
        shader
        for shader in SHADERS
        if shader not in used_shaders
    ]

    candidates = list(SHADERS)

    # --------------------------------------------------------
    # Copertura anticipata
    #
    # Se le finestre rimaste prima della deadline sono appena
    # sufficienti per mostrare gli shader mancanti, da questo
    # momento restringiamo la scelta ai soli mancanti.
    # --------------------------------------------------------
    if (
        window_start < EARLY_COVERAGE_END
        and
        missing_shaders
        and
        coverage_windows_left > 0
        and
        len(missing_shaders) >= coverage_windows_left
    ):
        candidates = list(missing_shaders)

    # --------------------------------------------------------
    # Copertura globale di sicurezza
    #
    # Dovrebbe ormai intervenire raramente, ma mantiene la vecchia
    # garanzia: nessuno shader può sparire completamente dal video.
    # --------------------------------------------------------
    elif (
        missing_shaders
        and
        len(missing_shaders) >= windows_left
    ):
        candidates = list(missing_shaders)

    # --------------------------------------------------------
    # Durata massima
    # --------------------------------------------------------
    if (
        current_shader is not None
        and
        current_scene_duration + window_duration
        > MAX_SCENE_DURATION + 1e-9
    ):
        candidates = [
            shader
            for shader in candidates
            if shader != current_shader
        ]

        if not candidates:
            candidates = [
                shader
                for shader in SHADERS
                if shader != current_shader
            ]

    # --------------------------------------------------------
    # Score di regia
    # --------------------------------------------------------
    adjusted_scores = {}

    for shader in candidates:
        score = scores[shader]

        # Durante la fase iniziale di copertura diamo un piccolo vantaggio
        # agli shader ancora non presentati.
        if (
            window_start < EARLY_COVERAGE_END
            and
            shader in missing_shaders
        ):
            score *= EARLY_MISSING_BOOST

        # Lo shader corrente può continuare senza penalità:
        # questo permette scene organiche da 20-30 secondi.
        #
        # Penalizziamo invece un ritorno troppo ravvicinato dopo
        # essere passati a un altro shader.
        if (
            shader != current_shader
            and
            shader in last_used_window
        ):
            windows_since_use = (
                window_index
                - last_used_window[shader]
            )

            if windows_since_use <= 2:
                score *= RECENCY_PENALTY_NEAR
            elif windows_since_use <= 4:
                score *= RECENCY_PENALTY_MEDIUM

        # ----------------------------------------------------
        # Fatica visiva
        #
        # Ogni finestra già assegnata a uno shader riduce
        # progressivamente il suo score futuro.
        #
        # Non è un divieto: se la musica continua ad avere
        # una forte affinità con quello shader, può ancora vincere.
        # ----------------------------------------------------
        previous_windows = usage_windows.get(
            shader,
            0
        )

        fatigue = (
            1.0 /
            (
                1.0 +
                0.10 * previous_windows
            )
        )

        score *= fatigue

        adjusted_scores[shader] = score

    return max(
        candidates,
        key=lambda shader: adjusted_scores[shader]
    )

def merge_adjacent_scenes(
    scenes: list
) -> list:
    """
    Evita scene consecutive con lo stesso shader.

    A -> B -> B -> A diventa semplicemente A -> B -> A.
    ABBA può continuare a fare musica altrove. :-)
    """

    if not scenes:
        return []

    merged = [scenes[0]]

    for scene in scenes[1:]:
        previous = merged[-1]

        if scene["shader"] == previous["shader"]:
            previous["end"] = scene["end"]
            previous["events"].extend(
                scene["events"]
            )
        else:
            merged.append(scene)

    return merged


def build_scenes(
    frames: list,
    visual_events: list,
    duration: float,
    attack_reference: float,
    spectral_flux_reference: float,
    rms_reference: float
) -> list:
    """
    Costruisce la regia completa del brano.
    """

    windows = build_scene_windows(
        duration
    )

    if len(SHADERS) > len(windows):
        raise ValueError(
            "Impossibile garantire tutti gli shader: "
            f"{len(SHADERS)} shader ma soltanto "
            f"{len(windows)} finestre da almeno "
            f"{MIN_SCENE_DURATION:.0f} secondi."
        )

    scenes = []
    used_shaders = set()
    last_used_window = {}

    # Numero di finestre già assegnate a ciascuno shader.
    # Serve per applicare una fatica visiva progressiva:
    # uno shader molto usato deve avere una ragione musicale
    # più forte per continuare a dominare la regia.
    usage_windows = {
        shader: 0
        for shader in SHADERS
    }

    current_shader = None
    current_scene_start = 0.0

    for index, window in enumerate(windows):
        start = window["start"]
        end = window["end"]
        window_duration = end - start

        window_frames = frames_in_window(
            frames,
            start,
            end
        )

        features = compute_window_features(
            window_frames,
            attack_reference,
            spectral_flux_reference,
            rms_reference
        )

        scores = {
            shader: score_shader(
                shader,
                features
            )
            for shader in SHADERS
        }

        windows_left = (
            len(windows) -
            index
        )

        # Quante finestre, inclusa quella corrente, terminano entro
        # la deadline di copertura anticipata?
        coverage_windows_left = sum(
            1
            for candidate_window in windows[index:]
            if (
                candidate_window["end"]
                <= EARLY_COVERAGE_END + 1e-9
            )
        )

        if current_shader is None:
            current_scene_duration = 0.0
        else:
            current_scene_duration = (
                start - current_scene_start
            )

        shader = select_shader_for_window(
            scores,
            used_shaders,
            usage_windows,
            windows_left,
            current_shader,
            current_scene_duration,
            window_duration,
            index,
            start,
            coverage_windows_left,
            last_used_window
        )

        if shader != current_shader:
            current_shader = shader
            current_scene_start = start

        used_shaders.add(shader)
        last_used_window[shader] = index
        usage_windows[shader] += 1

        scene ={
            "start": round(start, 3),
            "end": round(end, 3),
            "shader": shader,
            "events": events_in_window(
                visual_events,
                start,
                end
            ),
            "director": {
                "features": {
                    key: round(value, 4)
                    for key, value
                    in features.items()
                },
                "scores": {
                    key: round(value, 4)
                    for key, value
                    in scores.items()
                }
            }
        }

        # Alcuni shader possono richiedere risorse esterne.
        # Il Director dichiara la risorsa nella playlist;
        # sarà poi il Player a caricarla e passarla alla GPU.
        texture = SHADER_TEXTURES.get(shader)

        if texture is not None:
            scene["texture"] = texture

        scenes.append(scene)

    scenes = merge_adjacent_scenes(
        scenes
    )

    # Controllo finale del vincolo globale.
    final_shaders = {
        scene["shader"]
        for scene in scenes
    }

    missing = [
        shader
        for shader in SHADERS
        if shader not in final_shaders
    ]

    if missing:
        raise RuntimeError(
            "Il director non ha rispettato il vincolo di copertura. "
            f"Shader mancanti: {missing}"
        )

    return scenes


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

def main():

    with ANALYSIS_PATH.open(
        "r",
        encoding="utf-8"
    ) as file:
        analysis = json.load(file)

    metadata = analysis["metadata"]
    frames = analysis["frames"]

    attack_reference = metadata[
        "attackNormalizationReference"
    ]

    spectral_flux_reference = metadata[
        "spectralFluxNormalizationReference"
    ]

    rms_reference = metadata[
        "rmsNormalizationReference"
    ]

    duration = get_song_duration(
        metadata,
        frames
    )

    events = detect_events(
        frames,
        attack_reference,
        spectral_flux_reference,
        threshold=1.5
    )

    visual_events = [
        build_visual_event(event)
        for event in events
    ]

    scenes = build_scenes(
        frames,
        visual_events,
        duration,
        attack_reference,
        spectral_flux_reference,
        rms_reference
    )

    playlist = {
        "audio": metadata["audioFile"],
        "duration": round(duration, 3),
        "minimumSceneDuration": MIN_SCENE_DURATION,
        "maximumSceneDuration": MAX_SCENE_DURATION,
        "openingShader": OPENING_SHADER,
        "earlyCoverageEnd": EARLY_COVERAGE_END,
        "shaders": SHADERS,
        "scenes": scenes
    }

    PLAYLIST_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with PLAYLIST_PATH.open(
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            playlist,
            file,
            indent=2
        )

    print(
        f"Playlist scritta in: "
        f"{PLAYLIST_PATH}"
    )

    print(
        f"Eventi generati: "
        f"{len(visual_events)}"
    )

    print("\nRegia generata:")

    for scene in scenes:
        print(
            f"{scene['start']:7.3f}s -> "
            f"{scene['end']:7.3f}s  "
            f"{scene['shader']}"
        )


if __name__ == "__main__":
    main()
