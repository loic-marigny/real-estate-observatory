from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.shared.pipeline_config import load_pipeline_config


def log(message: str) -> None:
    print(f"[build_filosofi] {message}")


def load_years() -> list[int]:
    return load_pipeline_config()["filosofi_years"]


def load_sources() -> dict[str, dict[str, object]]:
    config_path = ROOT_DIR / "config" / "filosofi_sources.json"
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    sources = payload.get("sources", {})
    if not isinstance(sources, dict):
        raise RuntimeError("Invalid FiLoSoFi source configuration")
    return {
        str(year): source
        for year, source in sources.items()
        if isinstance(source, dict)
    }


def run_step(*args: str) -> None:
    command = [sys.executable, *args]
    log(f"Running: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT_DIR, check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build FiLoSoFi pipeline for one or more years.")
    parser.add_argument("--year", type=int, action="append", dest="years")
    parser.add_argument("--all-configured", action="store_true")
    parser.add_argument("--skip-public", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    configured_years = load_years()
    source_config = load_sources()
    if args.all_configured:
        years = configured_years
    elif args.years:
        years = [int(year) for year in args.years]
    else:
        raise SystemExit("Provide --year or --all-configured")

    if not years:
        raise SystemExit("No FiLoSoFi years configured")

    full_pipeline_years = [
        year
        for year in years
        if str(source_config.get(str(year), {}).get("pipeline_mode", "full_pipeline")) == "full_pipeline"
    ]
    latest_publishable_year = max(full_pipeline_years) if full_pipeline_years else None
    for year in years:
        source = source_config.get(str(year), {})
        pipeline_mode = str(source.get("pipeline_mode", "full_pipeline"))
        publish_public = year == latest_publishable_year and not args.skip_public
        year_args = ["--year", str(year), *(["--force"] if args.force else [])]
        run_step("-m", "data.scripts.filosofi.download", *year_args)
        if pipeline_mode == "bronze_only":
            log(f"Year {year} is configured as bronze-only. Skipping silver/gold/public steps.")
            continue
        run_step("-m", "data.scripts.filosofi.build_bronze", *year_args)
        run_step("-m", "data.scripts.filosofi.build_silver", *year_args)
        run_step(
            "-m",
            "data.scripts.filosofi.build_gold",
            *year_args,
            *(["--publish-public"] if publish_public else []),
        )
        if publish_public:
            run_step("-m", "data.scripts.publishing.build_public_previews", "--dataset", "filosofi", "--year", str(year))


if __name__ == "__main__":
    main()
