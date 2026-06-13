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


def try_run_step(*args: str) -> bool:
    command = [sys.executable, *args]
    log(f"Running: {' '.join(command)}")
    completed = subprocess.run(
        command,
        cwd=ROOT_DIR,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.stdout:
        print(completed.stdout, end="")
    if completed.stderr:
        print(completed.stderr, end="", file=sys.stderr)

    if completed.returncode == 0:
        return True

    unavailable_markers = [
        "is not available. Available years:",
        "No yearly DVF directories found",
    ]
    combined_output = f"{completed.stdout}\n{completed.stderr}"
    if any(marker in combined_output for marker in unavailable_markers):
        return False

    raise subprocess.CalledProcessError(completed.returncode, command)


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

    configured_latest_year = max(years)
    processed_years: list[int] = []
    for year in years:
        publish_public = year == configured_latest_year and not args.skip_public
        year_args = ["--year", str(year)]
        if not try_run_step("data/scripts/download_dvf.py", *year_args):
            log(f"Skipping DVF year {year}: not currently available upstream")
            continue
        run_step("data/scripts/build_bronze.py", *year_args)
        run_step("data/scripts/build_silver.py", *year_args)
        run_step(
            "data/scripts/build_gold.py",
            *year_args,
            *(["--publish-public"] if publish_public else []),
        )
        if publish_public:
            run_step("data/scripts/build_public_previews.py", "--dataset", "dvf", "--year", str(year))
        processed_years.append(year)

    if not processed_years:
        raise SystemExit("No configured DVF years were available upstream")

    if not args.skip_public:
        latest_processed_year = max(processed_years)
        if latest_processed_year != configured_latest_year:
            run_step("data/scripts/build_gold.py", "--year", str(latest_processed_year), "--publish-public")
            run_step(
                "data/scripts/build_public_previews.py",
                "--dataset",
                "dvf",
                "--year",
                str(latest_processed_year),
            )

    log(f"Processed DVF years: {processed_years}")


if __name__ == "__main__":
    main()
