import math


def normalize_vector(
    x: float,
    y: float,
    z: float
) -> list:
    """
    Normalizza un vettore 3D.

    Se il vettore è nullo, restituisce
    una direzione neutra verso la sfera.
    """

    length = math.sqrt(
        x * x +
        y * y +
        z * z
    )

    if length <= 0.0:
        return [0.0, 0.0, 1.0]

    return [
        x / length,
        y / length,
        z / length
    ]


def map_bands_to_hit_direction(
    bands: dict
) -> list:
    """
    Traduce il profilo spettrale
    in una direzione tridimensionale.

    Non classifica il suono:
    costruisce direttamente un vettore
    a partire dalle energie delle bande.
    """

    low = (
        bands["sub"] +
        bands["bass"]
    ) / 2.0

    middle = (
        bands["low_mid"] +
        bands["mid"]
    ) / 2.0

    high = (
        bands["high_mid"] +
        bands["high"]
    ) / 2.0

    x = 1.8 * (high - low)
    y = 1.8 * (middle - low)

    # Manteniamo sempre una componente
    # verso la profondità della sfera.
    z = 1.0

    return normalize_vector(
        x,
        y,
        z
    )

def map_event_to_hit_strength(
    event_strength: float
) -> float:
    """
    Traduce la forza logica dell'evento
    nella forza fisica usata dallo shader.
    """

    minimum_event = 2.0
    maximum_event = 3.5

    normalized = (
        event_strength - minimum_event
    ) / (
        maximum_event - minimum_event
    )

    normalized = max(
        0.0,
        min(
            normalized,
            1.0
        )
    )

    minimum_hit = 1.0
    maximum_hit = 2.2

    return (
        minimum_hit +
        normalized *
        (
            maximum_hit -
            minimum_hit
        )
    )