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


def build_impact_event(
    event: dict
) -> dict:
    """
    Traduce un evento rilevato nel formato
    richiesto dalla scena impact-sphere.

    Manteniamo anche i dati sorgente che hanno
    determinato la scelta del director:
    sono utili per capire e tarare la regia.
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

    events = detect_events(
        frames,
        attack_reference,
        spectral_flux_reference,
        threshold=1.5
    )

    impact_events = []

    for event in events:
        impact_events.append(
            build_impact_event(event)
        )

    playlist = {
        "audio": metadata["audioFile"],

        "scenes": [
            {
                "shader": "impact-sphere.frag",
                "events": impact_events
            }
        ]
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
        f"{len(impact_events)}"
    )


if __name__ == "__main__":
    main()