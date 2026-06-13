from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT_DIR / "config" / "pipeline_years.json"


def log(message: str) -> None:
    print(f"[build_dvf] {message}")


def load_years() -> list[int]:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    years = payload.get("dvf_years", [])
    return [int(year) for year in years]


def run_step(*args: str) -> None:
    command = [sys.executable, *args]
    log(f"Running: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT_DIR, check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build DVF pipeline for one or more years.")
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
        raise SystemExit("No DVF years configured")

    latest_year = max(years)
    for year in years:
        publish_public = year == latest_year and not args.skip_public
        year_args = ["--year", str(year)]
        run_step("data/scripts/download_dvf.py", *year_args)
        run_step("data/scripts/build_bronze.py", *year_args)
        run_step("data/scripts/build_silver.py", *year_args)
        run_step(
            "data/scripts/build_gold.py",
            *year_args,
            *(["--publish-public"] if publish_public else []),
        )
        if publish_public:
            run_step("data/scripts/build_public_previews.py", "--dataset", "dvf", "--year", str(year))


if __name__ == "__main__":
    main()
