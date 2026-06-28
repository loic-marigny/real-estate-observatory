from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.orchestration import build_filosofi
from scripts.shared.pipeline_config import FilosofiCatalog, load_filosofi_catalog, load_pipeline_config


def make_catalog_payload() -> dict[str, object]:
    return {
        "dataset": "filosofi",
        "default_year": 2023,
        "known_missing_years": [2022],
        "sources": {
            "2017": {"enabled": True, "source_type": "data_gouv", "pipeline_mode": "full_pipeline"},
            "2018": {"enabled": True, "source_type": "insee_xlsx_zip", "pipeline_mode": "full_pipeline"},
            "2019": {"enabled": True, "source_type": "insee_xlsx_zip", "pipeline_mode": "full_pipeline"},
            "2020": {"enabled": True, "source_type": "insee_xlsx_zip", "pipeline_mode": "full_pipeline"},
            "2021": {"enabled": True, "source_type": "insee_xlsx_zip", "pipeline_mode": "full_pipeline"},
            "2023": {"enabled": True, "source_type": "insee_filosofi2_multigeography", "pipeline_mode": "full_pipeline"},
        },
    }


class PipelineConfigTests(unittest.TestCase):
    def write_json(self, filename: str, payload: dict[str, object]) -> Path:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        path = Path(temp_dir.name) / filename
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def test_pipeline_config_now_only_returns_dvf_years(self) -> None:
        config = load_pipeline_config()
        self.assertEqual(config["dvf_years"], [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024])
        self.assertNotIn("filosofi_years", config)

    def test_valid_filosofi_catalog(self) -> None:
        path = self.write_json("filosofi_sources.json", make_catalog_payload())

        catalog = load_filosofi_catalog(path)

        self.assertEqual(catalog.available_years, [2017, 2018, 2019, 2020, 2021, 2023])
        self.assertEqual(catalog.enabled_years, [2017, 2018, 2019, 2020, 2021, 2023])
        self.assertEqual(catalog.default_year, 2023)
        self.assertEqual(catalog.known_missing_years, [2022])
        self.assertEqual(catalog.get_source(2023)["source_type"], "insee_filosofi2_multigeography")

    def test_available_but_disabled_year_is_exposed_but_not_enabled(self) -> None:
        payload = make_catalog_payload()
        payload["sources"]["2019"]["enabled"] = False
        path = self.write_json("filosofi_sources.json", payload)

        catalog = load_filosofi_catalog(path)

        self.assertIn(2019, catalog.available_years)
        self.assertNotIn(2019, catalog.enabled_years)
        self.assertFalse(catalog.get_source(2019)["enabled"])

    def test_unknown_year_raises_before_execution(self) -> None:
        path = self.write_json("filosofi_sources.json", make_catalog_payload())
        catalog = load_filosofi_catalog(path)

        with self.assertRaisesRegex(RuntimeError, "Unknown FiLoSoFi year 2024"):
            catalog.get_source(2024)

    def test_enabled_year_without_source_type_fails(self) -> None:
        payload = make_catalog_payload()
        payload["sources"]["2018"]["source_type"] = ""
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "source_type"):
            load_filosofi_catalog(path)

    def test_enabled_missing_fails(self) -> None:
        payload = make_catalog_payload()
        del payload["sources"]["2018"]["enabled"]
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "Missing required key 'enabled'"):
            load_filosofi_catalog(path)

    def test_enabled_non_boolean_fails(self) -> None:
        payload = make_catalog_payload()
        payload["sources"]["2018"]["enabled"] = "true"
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "expected a boolean"):
            load_filosofi_catalog(path)

    def test_default_year_absent_fails(self) -> None:
        payload = make_catalog_payload()
        del payload["default_year"]
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "default_year"):
            load_filosofi_catalog(path)

    def test_default_year_unknown_fails(self) -> None:
        payload = make_catalog_payload()
        payload["default_year"] = 2024
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "default_year 2024 is not present"):
            load_filosofi_catalog(path)

    def test_default_year_disabled_fails(self) -> None:
        payload = make_catalog_payload()
        payload["sources"]["2023"]["enabled"] = False
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "default_year 2023 is disabled"):
            load_filosofi_catalog(path)

    def test_sources_absent_or_empty_fails(self) -> None:
        missing_path = self.write_json("filosofi_sources_missing.json", {"dataset": "filosofi", "default_year": 2023})
        empty_path = self.write_json("filosofi_sources_empty.json", {"dataset": "filosofi", "default_year": 2023, "sources": {}})

        with self.assertRaisesRegex(RuntimeError, "sources"):
            load_filosofi_catalog(missing_path)
        with self.assertRaisesRegex(RuntimeError, "sources"):
            load_filosofi_catalog(empty_path)

    def test_invalid_year_key_fails(self) -> None:
        payload = make_catalog_payload()
        payload["sources"]["year2023"] = payload["sources"].pop("2023")
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "Invalid FiLoSoFi year key"):
            load_filosofi_catalog(path)

    def test_redundant_years_key_fails(self) -> None:
        payload = make_catalog_payload()
        payload["years"] = [2017, 2018]
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "Redundant key 'years'"):
            load_filosofi_catalog(path)

    def test_known_missing_years_cannot_overlap_available_years(self) -> None:
        payload = make_catalog_payload()
        payload["known_missing_years"] = [2021]
        path = self.write_json("filosofi_sources.json", payload)

        with self.assertRaisesRegex(RuntimeError, "known_missing_years overlaps"):
            load_filosofi_catalog(path)

    def test_all_configured_uses_only_enabled_years(self) -> None:
        catalog = FilosofiCatalog(
            available_years=[2017, 2018, 2019],
            enabled_years=[2017, 2019],
            default_year=2019,
            known_missing_years=[],
            sources={
                2017: {"enabled": True, "source_type": "data_gouv", "pipeline_mode": "bronze_only"},
                2018: {"enabled": False, "source_type": "insee_xlsx_zip", "pipeline_mode": "full_pipeline"},
                2019: {"enabled": True, "source_type": "insee_xlsx_zip", "pipeline_mode": "full_pipeline"},
            },
            path=Path("config/filosofi_sources.json"),
        )

        recorded_steps: list[tuple[str, ...]] = []

        def fake_run_step(*args: str) -> None:
            recorded_steps.append(args)

        with mock.patch.object(build_filosofi, "load_filosofi_catalog", return_value=catalog), \
            mock.patch.object(build_filosofi, "run_step", side_effect=fake_run_step), \
            mock.patch.object(build_filosofi, "parse_args", return_value=mock.Mock(all_configured=True, years=None, skip_public=True, force=False)):
            build_filosofi.main()

        joined = [" ".join(step) for step in recorded_steps]
        self.assertTrue(any("--year 2017" in step for step in joined))
        self.assertTrue(any("--year 2019" in step for step in joined))
        self.assertFalse(any("--year 2018" in step for step in joined))

    def test_year_can_run_disabled_available_year(self) -> None:
        catalog = FilosofiCatalog(
            available_years=[2018],
            enabled_years=[],
            default_year=2018,
            known_missing_years=[],
            sources={2018: {"enabled": False, "source_type": "insee_xlsx_zip", "pipeline_mode": "bronze_only"}},
            path=Path("config/filosofi_sources.json"),
        )

        recorded_steps: list[tuple[str, ...]] = []

        def fake_run_step(*args: str) -> None:
            recorded_steps.append(args)

        with mock.patch.object(build_filosofi, "load_filosofi_catalog", return_value=catalog), \
            mock.patch.object(build_filosofi, "run_step", side_effect=fake_run_step), \
            mock.patch.object(build_filosofi, "parse_args", return_value=mock.Mock(all_configured=False, years=[2018], skip_public=True, force=False)):
            build_filosofi.main()

        self.assertGreater(len(recorded_steps), 0)
        self.assertIn("-m", recorded_steps[0])
        self.assertIn("data.scripts.filosofi.download", recorded_steps[0])

    def test_current_catalog_remains_compatible(self) -> None:
        catalog = load_filosofi_catalog()
        self.assertEqual(catalog.available_years, [2017, 2018, 2019, 2020, 2021, 2023])
        self.assertEqual(catalog.enabled_years, [2017, 2018, 2019, 2020, 2021, 2023])
        self.assertEqual(catalog.default_year, 2023)
        self.assertEqual(catalog.known_missing_years, [2022])


if __name__ == "__main__":
    unittest.main()
