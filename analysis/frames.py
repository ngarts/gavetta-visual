import numpy as np


def get_frames(
    audio: np.ndarray,
    frame_size: int,
    hop_size: int
):
    """
    Divide il segnale in finestre sovrapposte.

    frame_size:
        numero di campioni contenuti nella finestra

    hop_size:
        numero di campioni di avanzamento tra due
        finestre consecutive
    """

    start = 0

    while start + frame_size <= len(audio):

        end = start + frame_size

        yield audio[start:end]

        start += hop_size