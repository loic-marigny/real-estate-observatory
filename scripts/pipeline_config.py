from __future__ import annotations

import json
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = ROOT_DIR / "config" / "pipeline_years.json"


def load_pipeline_config(config_path: Path | None = None) -> dict[str, list[int]]:
    path = config_path or DEFAULT_CONFIG_PATH
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        "dvf_years": [int(year) for year in payload.get("dvf_years", [])],
        "filosofi_years": [int(year) for year in payload.get("filosofi_years", [])],
    }
