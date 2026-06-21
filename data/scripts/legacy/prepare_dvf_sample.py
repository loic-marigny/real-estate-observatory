from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def log(message: str) -> None:
    print(f"[prepare_dvf_sample] {message}")


def main() -> None:
    log("prepare_dvf_sample.py is now a compatibility wrapper")
    log("Running scripts.orchestration.build_dvf for year 2024")
    root_dir = Path(__file__).resolve().parents[3]
    subprocess.run([sys.executable, "-m", "scripts.orchestration.build_dvf", "--year", "2024"], cwd=root_dir, check=True)


if __name__ == "__main__":
    main()
