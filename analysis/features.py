import numpy as np


def band_energy(
    frequencies: np.ndarray,
    magnitudes: np.ndarray,
    min_frequency: float,
    max_frequency: float
) -> float:
    """
    Calcola l'energia contenuta in una banda di frequenze.

    Selezioniamo i bin FFT compresi nell'intervallo:

        min_frequency <= f < max_frequency

    e sommiamo il quadrato delle magnitudini.

    Il quadrato è usato perché l'energia del segnale
    è proporzionale al quadrato dell'ampiezza.
    """

    mask = (
        (frequencies >= min_frequency) &
        (frequencies < max_frequency)
    )

    band_magnitudes = magnitudes[mask]

    return float(np.sum(band_magnitudes ** 2))

def compute_band_energies(
    frequencies: np.ndarray,
    magnitudes: np.ndarray,
    bands: dict
) -> dict:
    """
    Calcola l'energia di tutte le bande definite in bands.

    Restituisce un dizionario del tipo:

        {
            "sub": ...,
            "bass": ...,
            "low_mid": ...,
            ...
        }
    """

    energies = {}

    for band_name, (min_frequency, max_frequency) in bands.items():
        energies[band_name] = band_energy(
            frequencies,
            magnitudes,
            min_frequency,
            max_frequency
        )

    return energies

def normalize_energy(
    energy: float,
    reference: float
) -> float:
    """
    Normalizza un valore di energia nell'intervallo 0..1.

    reference rappresenta il livello che consideriamo
    "piena intensità".

    I valori superiori al riferimento vengono saturati a 1.
    """

    if reference <= 0.0:
        return 0.0

    return float(
        np.clip(
            energy / reference,
            0.0,
            1.0
        )
    )

def compute_rms(
    frame: np.ndarray
) -> float:
    """
    Calcola il Root Mean Square del frame.

    L'RMS misura l'ampiezza media efficace del segnale.
    È utile come indicatore dell'intensità complessiva
    del suono nella finestra analizzata.
    """

    return float(
        np.sqrt(
            np.mean(frame ** 2)
        )
    )

def compute_spectral_flux(
    magnitudes: np.ndarray,
    previous_magnitudes: np.ndarray
) -> float:
    """
    Misura quanto aumenta lo spettro rispetto al frame precedente.

    Consideriamo solo gli aumenti positivi dei singoli bin:
    se una componente cresce, contribuisce al flux;
    se diminuisce, non contribuisce.
    """

    difference = magnitudes - previous_magnitudes

    positive_difference = np.maximum(
        difference,
        0.0
    )

    return float(
        np.sum(
            positive_difference ** 2
        )
    )

def compute_spectral_centroid(
    frequencies: np.ndarray,
    magnitudes: np.ndarray
) -> float:
    """
    Calcola il baricentro dello spettro.

    Ogni frequenza viene pesata in base
    alla sua magnitudine.
    """

    total_magnitude = np.sum(
        magnitudes
    )

    if total_magnitude <= 0.0:
        return 0.0

    return float(
        np.sum(
            frequencies * magnitudes
        ) / total_magnitude
    )

def compute_spectral_spread(
    frequencies: np.ndarray,
    magnitudes: np.ndarray,
    spectral_centroid: float
) -> float:
    """
    Misura quanto lo spettro è disperso
    attorno al proprio centroide.

    È analogo a una deviazione standard,
    ma le frequenze vengono pesate
    in base alla loro magnitudine.
    """

    total_magnitude = np.sum(
        magnitudes
    )

    if total_magnitude <= 0.0:
        return 0.0

    squared_distance = (
        frequencies - spectral_centroid
    ) ** 2

    weighted_variance = np.sum(
        magnitudes * squared_distance
    ) / total_magnitude

    return float(
        np.sqrt(
            weighted_variance
        )
    )