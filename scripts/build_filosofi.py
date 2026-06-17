from __future__ import annotations

import argparse
import subprocess
import sys

from scripts.pipeline_config import load_pipeline_config
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]


def log(message: str) -> None:
    print(f"[build_filosofi] {message}")


def load_years() -> list[int]:
    return load_pipeline_config()["filosofi_years"]


def run_step(*args: str) -> None:
    command = [sys.executable, *args]
    log(f"Running: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT_DIR, check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build FiLoSoFi pipeline for one or more years.")
    parser.add_argument("--year", type=int, action="append", dest="years")
    parser.add_argument("--all-configured", action="store_true")
    parser.add_argument("--skip-public", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    configured_years = load_years()
    if args.all_configured:
        years = configured_years
    elif args.years:
        years = [int(year) for year in args.years]
    else:
        raise SystemExit("Provide --year or --all-configured")

    if not years:
        raise SystemExit("No FiLoSoFi years configured")

    latest_year = max(years)
    for year in years:
        publish_public = year == latest_year and not args.skip_public
        year_args = ["--year", str(year)]
        run_step("data/scripts/download_filosofi.py", *year_args)
        run_step("data/scripts/build_filosofi_bronze.py", *year_args)
        run_step("data/scripts/build_filosofi_silver.py", *year_args)
        run_step(
            "data/scripts/build_filosofi_gold.py",
            *year_args,
            *(["--publish-public"] if publish_public else []),
        )
        if publish_public:
            run_step("data/scripts/build_public_previews.py", "--dataset", "filosofi", "--year", str(year))


if __name__ == "__main__":
    main()
