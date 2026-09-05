import json
from pathlib import Path


def write_analysis_json(
    output_path: Path,
    data: dict
) -> None:
    """
    Scrive i risultati dell'analisi in formato JSON.

    La cartella di destinazione viene creata
    automaticamente se non esiste.
    """

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with output_path.open(
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            data,
            file,
            indent=2
        )