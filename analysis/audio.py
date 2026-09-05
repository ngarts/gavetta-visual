from pathlib import Path

import numpy as np
import soundfile as sf


def load_audio(audio_path: Path):
    """
    Carica un file audio.

    Restituisce:
        audio       -> campioni del segnale
        sample_rate -> campioni al secondo
    """

    return sf.read(audio_path)


def stereo_to_mono(audio: np.ndarray) -> np.ndarray:
    """
    Converte un segnale multicanale in mono calcolando
    la media dei canali.

    Se il segnale è già mono viene restituito invariato.
    """

    if audio.ndim == 1:
        return audio

    return np.mean(audio, axis=1)