def compute_event_strength(frame: dict) -> float:
    """
    Combina due indicatori di variazione rapida:
    - attack: crescita dell'intensità
    - spectral flux: cambiamento dello spettro

    Non decide ancora il tipo di evento visivo.
    Restituisce soltanto quanto il frame
    appare significativo per la regia.
    """

    attack = frame["attackNormalized"]
    spectral_flux = frame["spectralFluxNormalized"]

    return (
        0.6 * attack +
        0.4 * spectral_flux
    )

def detect_events(
    frames: list,
    threshold: float = 0.5,
    min_interval: float = 0.15
) -> list:
    """
    Individua eventi significativi.

    threshold:
        forza minima richiesta.

    min_interval:
        distanza minima tra due eventi,
        per evitare di generare più eventi
        quasi nello stesso istante.
    """

    events = []

    last_event_time = -float("inf")

    for frame in frames:
        strength = compute_event_strength(frame)

        if strength < threshold:
            continue

        time = frame["time"]

        if time - last_event_time < min_interval:
            continue

        events.append({
            "time": time,
            "strength": strength
        })

        last_event_time = time

    return events

def compute_event_components(
    frame: dict,
    attack_reference: float,
    spectral_flux_reference: float
) -> dict:
    """
    Calcola le componenti che il director usa
    per valutare la rilevanza del frame.

    I valori non vengono limitati a 1:
    i picchi superiori al p95 mantengono
    quindi la loro intensità relativa.
    """

    attack = (
        frame["attack"] /
        attack_reference
    )

    spectral_flux = (
        frame["spectralFlux"] /
        spectral_flux_reference
    )

    return {
        "attack": attack,
        "spectralFlux": spectral_flux
    }


def compute_event_strength(
    frame: dict,
    attack_reference: float,
    spectral_flux_reference: float
) -> float:

    components = compute_event_components(
        frame,
        attack_reference,
        spectral_flux_reference
    )

    return (
        0.6 * components["attack"] +
        0.4 * components["spectralFlux"]
    )


def detect_events(
    frames: list,
    attack_reference: float,
    spectral_flux_reference: float,
    threshold: float = 1.0,
    min_interval: float = 0.15
) -> list:
    """
    Cerca picchi locali dello score.

    Un frame è candidato a evento quando:
    - supera la soglia;
    - è maggiore del frame precedente;
    - è almeno pari al frame successivo;
    - è abbastanza distante dall'ultimo evento.
    """

    events = []

    last_event_time = -float("inf")

    for index in range(
        1,
        len(frames) - 1
    ):
        previous_strength = compute_event_strength(
            frames[index - 1],
            attack_reference,
            spectral_flux_reference
        )

        current_strength = compute_event_strength(
            frames[index],
            attack_reference,
            spectral_flux_reference
        )

        next_strength = compute_event_strength(
            frames[index + 1],
            attack_reference,
            spectral_flux_reference
        )

        if current_strength < threshold:
            continue

        is_local_peak = (
            current_strength > previous_strength
            and
            current_strength >= next_strength
        )

        if not is_local_peak:
            continue

        time = frames[index]["time"]

        if time - last_event_time < min_interval:
            continue

        components = compute_event_components(
            frames[index],
            attack_reference,
            spectral_flux_reference
        )

        events.append({
            "time": time,
            "strength": current_strength,

            "attack": components["attack"],
            "spectralFlux": components["spectralFlux"],

            "spectralCentroid":
                frames[index]["spectralCentroid"],

            "spectralSpread":
                frames[index]["spectralSpread"],

            "bands":
                frames[index]["bands"]
        })

        last_event_time = time

    return events