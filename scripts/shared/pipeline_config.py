from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_PIPELINE_CONFIG_PATH = ROOT_DIR / "config" / "pipeline_years.json"
DEFAULT_FILOSOFI_CONFIG_PATH = ROOT_DIR / "config" / "filosofi_sources.json"


def _read_json_object(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise RuntimeError(f"Configuration file not found: {path}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Invalid JSON in configuration file: {path}") from error

    if not isinstance(payload, dict):
        raise RuntimeError(f"Configuration root must be a JSON object: {path}")
    return payload


def load_pipeline_config(config_path: Path | None = None) -> dict[str, list[int]]:
    path = config_path or DEFAULT_PIPELINE_CONFIG_PATH
    payload = _read_json_object(path)
    years = payload.get("dvf_years", [])
    if not isinstance(years, list):
        raise RuntimeError(f"Invalid key 'dvf_years' in {path}: expected a list")
    return {
        "dvf_years": [int(year) for year in years],
    }


@dataclass(frozen=True)
class FilosofiCatalog:
    available_years: list[int]
    enabled_years: list[int]
    default_year: int
    sources: dict[int, dict[str, Any]]
    path: Path

    def get_source(self, year: int, *, allow_disabled: bool = True) -> dict[str, Any]:
        source = self.sources.get(int(year))
        if source is None:
            raise RuntimeError(f"Unknown FiLoSoFi year {year} in {self.path}")
        if not allow_disabled and not source["enabled"]:
            raise RuntimeError(f"FiLoSoFi year {year} is present in {self.path} but disabled")
        return source


def load_filosofi_catalog(config_path: Path | None = None) -> FilosofiCatalog:
    path = config_path or DEFAULT_FILOSOFI_CONFIG_PATH
    payload = _read_json_object(path)

    dataset = payload.get("dataset")
    if dataset != "filosofi":
        raise RuntimeError(f"Invalid key 'dataset' in {path}: expected 'filosofi', got {dataset!r}")

    if "years" in payload:
        raise RuntimeError(f"Redundant key 'years' is not allowed in target FiLoSoFi catalog: {path}")

    if "default_year" not in payload:
        raise RuntimeError(f"Missing required key 'default_year' in {path}")

    default_year_raw = payload["default_year"]
    try:
        default_year = int(default_year_raw)
    except (TypeError, ValueError) as error:
        raise RuntimeError(f"Invalid key 'default_year' in {path}: expected an integer year") from error

    sources_raw = payload.get("sources")
    if not isinstance(sources_raw, dict) or not sources_raw:
        raise RuntimeError(f"Invalid key 'sources' in {path}: expected a non-empty object")

    normalized_sources: dict[int, dict[str, Any]] = {}
    for raw_year, source in sources_raw.items():
        try:
            year = int(raw_year)
        except (TypeError, ValueError) as error:
            raise RuntimeError(f"Invalid FiLoSoFi year key {raw_year!r} in {path}: expected an integer-like string") from error

        if year in normalized_sources:
            raise RuntimeError(f"Duplicate FiLoSoFi year {year} detected after normalization in {path}")

        if not isinstance(source, dict):
            raise RuntimeError(f"Invalid FiLoSoFi source entry for year {year} in {path}: expected an object")

        if "enabled" not in source:
            raise RuntimeError(f"Missing required key 'enabled' for FiLoSoFi year {year} in {path}")

        enabled = source["enabled"]
        if not isinstance(enabled, bool):
            raise RuntimeError(f"Invalid key 'enabled' for FiLoSoFi year {year} in {path}: expected a boolean")

        source_type = str(source.get("source_type") or "").strip()
        if enabled and not source_type:
            raise RuntimeError(
                f"Missing required key 'source_type' for enabled FiLoSoFi year {year} in {path}"
            )

        normalized_sources[year] = {
            **source,
            "enabled": enabled,
        }

    available_years = sorted(normalized_sources.keys())
    enabled_years = sorted(year for year, source in normalized_sources.items() if source["enabled"])

    if default_year not in normalized_sources:
        raise RuntimeError(f"default_year {default_year} is not present in FiLoSoFi catalog {path}")

    if not normalized_sources[default_year]["enabled"]:
        raise RuntimeError(f"default_year {default_year} is disabled in FiLoSoFi catalog {path}")

    return FilosofiCatalog(
        available_years=available_years,
        enabled_years=enabled_years,
        default_year=default_year,
        sources=normalized_sources,
        path=path,
    )
