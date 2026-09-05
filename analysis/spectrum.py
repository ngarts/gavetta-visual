import numpy as np


def compute_spectrum(
    frame: np.ndarray,
    sample_rate: int
):
    """
    Calcola lo spettro di frequenza del frame.

    La finestra di Hann attenua i bordi del frame
    per ridurre la dispersione spettrale causata
    dal taglio netto del segnale.
    """

    window = np.hanning(
        len(frame)
    )

    windowed_frame = frame * window

    spectrum = np.fft.rfft(
        windowed_frame
    )

    magnitudes = np.abs(
        spectrum
    )

    frequencies = np.fft.rfftfreq(
        len(frame),
        d=1.0 / sample_rate
    )

    return frequencies, magnitudes