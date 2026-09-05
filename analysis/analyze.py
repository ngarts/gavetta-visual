import numpy as np

from pathlib import Path

from audio import load_audio, stereo_to_mono
from frames import get_frames
from spectrum import compute_spectrum
from features import compute_band_energies, normalize_energy, compute_rms, compute_spectral_flux, compute_spectral_centroid, compute_spectral_spread
from output import write_analysis_json

# ============================================================
# CONFIGURAZIONE
# ============================================================

AUDIO_FILE = Path("audio/nicolagullo-gavetta.wav")

FFT_SIZE = 2048
HOP_SIZE = 1024

FREQUENCY_BANDS = {
    "sub":       (20.0,    60.0),
    "bass":      (60.0,   160.0),
    "low_mid":  (160.0,   500.0),
    "mid":      (500.0,  2000.0),
    "high_mid": (2000.0, 6000.0),
    "high":     (6000.0, 16000.0),
}

OUTPUT_FILE = Path("data/gavetta-analysis.json")

# ============================================================
# MAIN
# ============================================================

def main():

    audio, sample_rate = load_audio(AUDIO_FILE)

    mono = stereo_to_mono(audio)

    print("=== AUDIO INFO ===")
    print(f"File:        {AUDIO_FILE}")
    print(f"Sample rate: {sample_rate} Hz")
    print(f"Duration:    {len(audio) / sample_rate:.3f} s")
    print(f"Shape:       {audio.shape}")

    print()
    print("=== ANALYSIS FRAMES ===")

    frame_count = 0

    analysis_frames = []

    previous_magnitudes = None

    for frame_count, frame in enumerate(
        get_frames(
            mono,
            FFT_SIZE,
            HOP_SIZE
        )
    ):
        timestamp = (
            frame_count *
            HOP_SIZE /
            sample_rate
        )

        frequencies, magnitudes = compute_spectrum(
            frame,
            sample_rate
        )

        spectral_centroid = compute_spectral_centroid(
            frequencies,
            magnitudes
        )

        spectral_spread = compute_spectral_spread(
            frequencies,
            magnitudes,
            spectral_centroid
        )

        if previous_magnitudes is None:
            spectral_flux = 0.0
        else:
            spectral_flux = compute_spectral_flux(
                magnitudes,
                previous_magnitudes
            )

        previous_magnitudes = magnitudes

        energies = compute_band_energies(
            frequencies,
            magnitudes,
            FREQUENCY_BANDS
        )

        rms = compute_rms(frame)

        analysis_frames.append({
            "time": timestamp,
            "rms": rms,
            "spectralFlux": spectral_flux,
            "spectralCentroid": spectral_centroid,
            "spectralSpread": spectral_spread,
            "energies": energies
        })

    rms_values = np.array([
        frame["rms"]
        for frame in analysis_frames
    ])

    print()
    print("=== RMS STATISTICS ===")
    print(f"min : {np.min(rms_values):.6f}")
    print(f"max : {np.max(rms_values):.6f}")
    print(f"p95 : {np.percentile(rms_values, 95):.6f}")

    rms_reference = float(
        np.percentile(
            rms_values,
            95
        )
    )

    previous_rms = analysis_frames[0]["rms"]

    for frame in analysis_frames:
        current_rms = frame["rms"]

        frame["attack"] = max(
            current_rms - previous_rms,
            0.0
        )

        previous_rms = current_rms

    attack_values = np.array([
        frame["attack"]
        for frame in analysis_frames
    ])

    print()
    print("=== ATTACK STATISTICS ===")
    print(f"min : {np.min(attack_values):.6f}")
    print(f"max : {np.max(attack_values):.6f}")
    print(f"p95 : {np.percentile(attack_values, 95):.6f}")

    attack_reference = float(
        np.percentile(
            attack_values,
            95
        )
    )

    spectral_flux_values = np.array([
        frame["spectralFlux"]
        for frame in analysis_frames
    ])

    print()
    print("=== SPECTRAL FLUX STATISTICS ===")
    print(f"min : {np.min(spectral_flux_values):.6f}")
    print(f"max : {np.max(spectral_flux_values):.6f}")
    print(
        f"p95 : "
        f"{np.percentile(spectral_flux_values, 95):.6f}"
    )

    spectral_flux_reference = float(
        np.percentile(
            spectral_flux_values,
            95
        )
    )

    spectral_centroid_values = np.array([
        frame["spectralCentroid"]
        for frame in analysis_frames
    ])

    print()
    print("=== SPECTRAL CENTROID STATISTICS ===")
    print(
        f"min : "
        f"{np.min(spectral_centroid_values):.3f} Hz"
    )
    print(
        f"max : "
        f"{np.max(spectral_centroid_values):.3f} Hz"
    )
    print(
        f"p95 : "
        f"{np.percentile(spectral_centroid_values, 95):.3f} Hz"
    )

    spectral_spread_values = np.array([
        frame["spectralSpread"]
        for frame in analysis_frames
    ])

    print()
    print("=== SPECTRAL SPREAD STATISTICS ===")
    print(
        f"min : "
        f"{np.min(spectral_spread_values):.3f} Hz"
    )
    print(
        f"max : "
        f"{np.max(spectral_spread_values):.3f} Hz"
    )
    print(
        f"p95 : "
        f"{np.percentile(spectral_spread_values, 95):.3f} Hz"
    )

    band_references = {}

    for band_name in FREQUENCY_BANDS:

        values = np.array([
            frame["energies"][band_name]
            for frame in analysis_frames
        ])

        band_references[band_name] = float(
            np.percentile(values, 95)
        )

    for frame in analysis_frames:

        normalized = {}

        for band_name, energy in frame["energies"].items():

            reference = band_references[band_name]

            normalized[band_name] = normalize_energy(
                energy,
                reference
            )

        frame["bands"] = normalized

        frame["rmsNormalized"] = normalize_energy(
            frame["rms"],
            rms_reference
        )

        frame["attackNormalized"] = normalize_energy(
            frame["attack"],
            attack_reference
        )

        frame["spectralFluxNormalized"] = normalize_energy(
            frame["spectralFlux"],
            spectral_flux_reference
        )

    print()
    print("=== NORMALIZED FRAMES ===")

    for frame in analysis_frames[:3]:
        print(frame)

    strongest_bass_frame = max(
        analysis_frames,
        key=lambda frame: frame["bands"]["bass"]
    )

    print()
    print("=== STRONGEST BASS FRAME ===")
    print(strongest_bass_frame)

    analysis_data = {
        "metadata": {
            "audioFile": AUDIO_FILE.name,
            "sampleRate": sample_rate,
            "duration": len(audio) / sample_rate,
            "fftSize": FFT_SIZE,
            "hopSize": HOP_SIZE,
            "frameCount": len(analysis_frames),
            "rmsNormalizationReference": rms_reference,
            "attackNormalizationReference": attack_reference,
            "spectralFluxNormalizationReference": spectral_flux_reference
        },

        "frequencyBands": {
            band_name: {
                "minFrequency": min_frequency,
                "maxFrequency": max_frequency,
                "normalizationReference": band_references[band_name]            }
            for band_name, (
                min_frequency,
                max_frequency
            ) in FREQUENCY_BANDS.items()
        },

        "frames": analysis_frames
    }

    write_analysis_json(
        OUTPUT_FILE,
        analysis_data
    )

    print()
    print(f"Analysis written to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()