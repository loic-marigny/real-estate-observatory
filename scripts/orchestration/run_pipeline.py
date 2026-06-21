from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.shared.pipeline_config import load_pipeline_config


def log(message: str) -> None:
    print(f"[run_pipeline] {message}")


def load_config() -> dict[str, list[int]]:
    return load_pipeline_config()


def run_step(*args: str) -> None:
    command = [sys.executable, *args]
    log(f"Running: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT_DIR, check=True)


def main() -> None:
    config = load_config()
    processed = {"dvf": [], "filosofi": []}

    for year in config["dvf_years"]:
        run_step("-m", "scripts.orchestration.build_dvf", "--year", str(year), "--skip-public")
        processed["dvf"].append(year)

    if processed["dvf"]:
        latest_dvf_year = max(processed["dvf"])
        run_step("-m", "data.scripts.dvf.build_gold", "--year", str(latest_dvf_year), "--publish-public")
        run_step("-m", "data.scripts.publishing.build_public_previews", "--dataset", "dvf", "--year", str(latest_dvf_year))

    for year in config["filosofi_years"]:
        run_step("-m", "scripts.orchestration.build_filosofi", "--year", str(year), "--skip-public")
        processed["filosofi"].append(year)

    if processed["filosofi"]:
        latest_filosofi_year = max(processed["filosofi"])
        run_step("-m", "data.scripts.filosofi.build_gold", "--year", str(latest_filosofi_year), "--publish-public")
        run_step("-m", "data.scripts.publishing.build_public_previews", "--dataset", "filosofi", "--year", str(latest_filosofi_year))

    run_step("-m", "data.scripts.publishing.build_commune_year")

    log(f"Processed DVF years: {processed['dvf']}")
    log(f"Processed FiLoSoFi years: {processed['filosofi']}")
    log("Produced data/gold/commune_year/commune_year.parquet")


if __name__ == "__main__":
    main()
