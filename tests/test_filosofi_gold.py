from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import pandas as pd

from data.scripts.filosofi import build_gold
from data.scripts.filosofi.build_gold import (
    available_catalog_years,
    build_summary_collection_payload,
    build_commune_frame,
    build_department_frame,
    build_indicator_availability_payload,
    build_metadata_payload,
    canonical_mapping,
    compute_year_summary,
    derive_department_frame_from_communes,
    methodology_breaks_from_catalog,
    row_level_comparability,
    write_schema_report,
)


class FiLoSoFiGoldTests(unittest.TestCase):
    def setUp(self) -> None:
        self.mapping = canonical_mapping()

    def write_catalog(self, payload: dict[str, object]) -> Path:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        path = Path(temp_dir.name) / "filosofi_sources.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def test_2017_commune_keeps_d2_to_d8_and_name_null(self) -> None:
        silver = pd.DataFrame(
            {
                "commune_code": ["01001"],
                "commune_name": ["Abergement"],
                "median_income": [23310.0],
                "d1_income": [12000.0],
                "d2_income": [15000.0],
                "d3_income": [16000.0],
                "d4_income": [17000.0],
                "d5_income": [23310.0],
                "d6_income": [26000.0],
                "d7_income": [28000.0],
                "d8_income": [30000.0],
                "d9_income": [34350.0],
                "poverty_rate": [17.0],
                "tax_households": [317.0],
                "population": [796.0],
            }
        )

        frame = build_commune_frame(silver, 2017, "filosofi", "legacy", self.mapping)

        self.assertEqual(frame.loc[0, "geography_code"], "01001")
        self.assertTrue(pd.isna(frame.loc[0, "geography_name"]))
        self.assertTrue(pd.isna(frame.loc[0, "d2_income"]))
        self.assertTrue(pd.isna(frame.loc[0, "d8_income"]))
        self.assertTrue(pd.isna(frame.loc[0, "d5_income"]))
        self.assertEqual(frame.loc[0, "indicator_source"], "official_insee")
        self.assertTrue(bool(frame.loc[0, "is_official"]))

    def test_2023_commune_keeps_deciles_and_counts_null_when_unpublished(self) -> None:
        silver = pd.DataFrame(
            {
                "commune_code": ["01001"],
                "commune_name": [""],
                "median_income": [22000.0],
                "d1_income": [pd.NA],
                "d2_income": [pd.NA],
                "d3_income": [pd.NA],
                "d4_income": [pd.NA],
                "d5_income": [22000.0],
                "d6_income": [pd.NA],
                "d7_income": [pd.NA],
                "d8_income": [pd.NA],
                "d9_income": [pd.NA],
                "poverty_rate": [14.2],
                "tax_households": [pd.NA],
                "population": [pd.NA],
            }
        )

        frame = build_commune_frame(silver, 2023, "filosofi2", "filosofi2", self.mapping)

        self.assertEqual(frame.loc[0, "median_income"], 22000.0)
        self.assertTrue(pd.isna(frame.loc[0, "d1_income"]))
        self.assertTrue(pd.isna(frame.loc[0, "d9_income"]))
        self.assertTrue(pd.isna(frame.loc[0, "d5_income"]))
        self.assertTrue(pd.isna(frame.loc[0, "tax_households"]))
        self.assertTrue(pd.isna(frame.loc[0, "population"]))
        self.assertFalse(bool(frame.loc[0, "comparable_with_previous_years"]))

    def test_department_frames_mark_official_and_derived_series(self) -> None:
        commune_frame = pd.DataFrame(
            {
                "geography_code": pd.Series(["01001", "01002"], dtype="string"),
                "geography_name": pd.Series(["A", "B"], dtype="string"),
                "geography_level": pd.Series(["commune", "commune"], dtype="string"),
                "year": pd.Series([2018, 2018], dtype="Int64"),
                "dispositif": pd.Series(["filosofi", "filosofi"], dtype="string"),
                "source_generation": pd.Series(["historical", "historical"], dtype="string"),
                "indicator_source": pd.Series(["official_insee", "official_insee"], dtype="string"),
                "is_official": pd.Series([True, True], dtype="boolean"),
                "methodology_version": pd.Series(["filosofi_v1", "filosofi_v1"], dtype="string"),
                "comparable_with_previous_years": pd.Series([True, True], dtype="boolean"),
                "median_income": pd.Series([22000.0, 24000.0], dtype="Float64"),
                "d1_income": pd.Series([12000.0, 13000.0], dtype="Float64"),
                "d2_income": pd.Series([15000.0, 16000.0], dtype="Float64"),
                "d3_income": pd.Series([18000.0, 19000.0], dtype="Float64"),
                "d4_income": pd.Series([20000.0, 21000.0], dtype="Float64"),
                "d5_income": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "d6_income": pd.Series([26000.0, 27000.0], dtype="Float64"),
                "d7_income": pd.Series([29000.0, 30000.0], dtype="Float64"),
                "d8_income": pd.Series([33000.0, 34000.0], dtype="Float64"),
                "d9_income": pd.Series([39000.0, 40000.0], dtype="Float64"),
                "poverty_rate": pd.Series([14.5, 10.2], dtype="Float64"),
                "tax_households": pd.Series([10.0, 20.0], dtype="Float64"),
                "population": pd.Series([25.0, 40.0], dtype="Float64"),
            }
        )

        derived = derive_department_frame_from_communes(commune_frame, 2018, "filosofi")
        self.assertEqual(derived.loc[0, "indicator_source"], "derived_from_communes")
        self.assertFalse(bool(derived.loc[0, "is_official"]))
        self.assertTrue(pd.isna(derived.loc[0, "d5_income"]))

        department_silver = pd.DataFrame(
            {
                "department_code": ["01"],
                "median_income": [25000.0],
                "d1_income": [14000.0],
                "d2_income": [16000.0],
                "d3_income": [18000.0],
                "d4_income": [20000.0],
                "d5_income": [25000.0],
                "d6_income": [28000.0],
                "d7_income": [30000.0],
                "d8_income": [33000.0],
                "d9_income": [39000.0],
                "poverty_rate": [12.5],
                "tax_households": [pd.NA],
                "population": [pd.NA],
            }
        )
        official, indicator_source = build_department_frame(
            department_silver,
            commune_frame.iloc[0:0].copy(),
            2023,
            "filosofi2",
            "filosofi2",
            self.mapping,
        )
        self.assertEqual(indicator_source, "official_insee")
        self.assertTrue(bool(official.loc[0, "is_official"]))
        self.assertTrue(pd.isna(official.loc[0, "d5_income"]))

    def test_year_summary_falls_back_to_department_deciles_when_communes_do_not_publish_them(self) -> None:
        commune_frame = pd.DataFrame(
            {
                "geography_code": pd.Series(["01001"], dtype="string"),
                "geography_name": pd.Series([pd.NA], dtype="string"),
                "geography_level": pd.Series(["commune"], dtype="string"),
                "year": pd.Series([2023], dtype="Int64"),
                "dispositif": pd.Series(["filosofi2"], dtype="string"),
                "source_generation": pd.Series(["filosofi2"], dtype="string"),
                "indicator_source": pd.Series(["official_insee"], dtype="string"),
                "is_official": pd.Series([True], dtype="boolean"),
                "methodology_version": pd.Series(["filosofi_v2"], dtype="string"),
                "comparable_with_previous_years": pd.Series([False], dtype="boolean"),
                "median_income": pd.Series([22000.0], dtype="Float64"),
                "d1_income": pd.Series([pd.NA], dtype="Float64"),
                "d2_income": pd.Series([pd.NA], dtype="Float64"),
                "d3_income": pd.Series([pd.NA], dtype="Float64"),
                "d4_income": pd.Series([pd.NA], dtype="Float64"),
                "d5_income": pd.Series([pd.NA], dtype="Float64"),
                "d6_income": pd.Series([pd.NA], dtype="Float64"),
                "d7_income": pd.Series([pd.NA], dtype="Float64"),
                "d8_income": pd.Series([pd.NA], dtype="Float64"),
                "d9_income": pd.Series([pd.NA], dtype="Float64"),
                "poverty_rate": pd.Series([14.2], dtype="Float64"),
                "tax_households": pd.Series([pd.NA], dtype="Float64"),
                "population": pd.Series([pd.NA], dtype="Float64"),
            }
        )
        department_frame = pd.DataFrame(
            {
                "geography_code": pd.Series(["01", "02"], dtype="string"),
                "geography_name": pd.Series([pd.NA, pd.NA], dtype="string"),
                "geography_level": pd.Series(["department", "department"], dtype="string"),
                "year": pd.Series([2023, 2023], dtype="Int64"),
                "dispositif": pd.Series(["filosofi2", "filosofi2"], dtype="string"),
                "source_generation": pd.Series(["filosofi2", "filosofi2"], dtype="string"),
                "indicator_source": pd.Series(["official_insee", "official_insee"], dtype="string"),
                "is_official": pd.Series([True, True], dtype="boolean"),
                "methodology_version": pd.Series(["filosofi_v2", "filosofi_v2"], dtype="string"),
                "comparable_with_previous_years": pd.Series([False, False], dtype="boolean"),
                "median_income": pd.Series([25000.0, 26000.0], dtype="Float64"),
                "d1_income": pd.Series([14000.0, 12000.0], dtype="Float64"),
                "d2_income": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "d3_income": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "d4_income": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "d5_income": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "d6_income": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "d7_income": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "d8_income": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "d9_income": pd.Series([42000.0, 38000.0], dtype="Float64"),
                "poverty_rate": pd.Series([12.0, 14.0], dtype="Float64"),
                "tax_households": pd.Series([pd.NA, pd.NA], dtype="Float64"),
                "population": pd.Series([pd.NA, pd.NA], dtype="Float64"),
            }
        )

        summary = compute_year_summary(
            commune_frame,
            department_frame,
            2023,
            "filosofi2",
            "official_insee",
        )

        self.assertEqual(summary["decile_summary"]["d1_income"], 12000.0)
        self.assertEqual(summary["decile_summary"]["d9_income"], 38000.0)
        self.assertIsNone(summary["decile_summary"]["d5_income"])

    def test_summary_collection_payload_indexes_yearly_summaries(self) -> None:
        payload = build_summary_collection_payload(
            {
                2017: {"latest_year": 2017, "communes_covered": 1},
                2023: {"latest_year": 2023, "communes_covered": 2},
            }
        )

        self.assertEqual(payload["available_years"], [2017, 2023])
        self.assertEqual(payload["latest_year"], 2023)
        self.assertEqual(payload["summaries_by_year"]["2017"]["communes_covered"], 1)

    def test_indicator_availability_and_metadata_capture_missing_2022(self) -> None:
        commune_2017 = build_commune_frame(
            pd.DataFrame(
                {
                    "commune_code": ["01001"],
                    "commune_name": ["A"],
                    "median_income": [23310.0],
                    "d1_income": [12000.0],
                    "d9_income": [34350.0],
                    "poverty_rate": [17.0],
                    "tax_households": [317.0],
                    "population": [796.0],
                }
            ),
            2017,
            "filosofi",
            "legacy",
            self.mapping,
        )
        commune_2023 = build_commune_frame(
            pd.DataFrame(
                {
                    "commune_code": ["01001"],
                    "commune_name": [""],
                    "median_income": [22000.0],
                    "d1_income": [pd.NA],
                    "d9_income": [pd.NA],
                    "poverty_rate": [14.2],
                    "tax_households": [pd.NA],
                    "population": [pd.NA],
                }
            ),
            2023,
            "filosofi2",
            "filosofi2",
            self.mapping,
        )
        department_2017, _ = build_department_frame(
            pd.DataFrame(
                {
                    "department_code": ["01"],
                    "median_income": [24000.0],
                    "d1_income": [13000.0],
                    "d9_income": [38000.0],
                    "poverty_rate": [15.0],
                    "tax_households": [1000.0],
                    "population": [2500.0],
                }
            ),
            commune_2017.iloc[0:0].copy(),
            2017,
            "filosofi",
            "legacy",
            self.mapping,
        )
        department_derived = derive_department_frame_from_communes(
            pd.DataFrame(
                {
                    "geography_code": pd.Series(["01001"], dtype="string"),
                    "geography_name": pd.Series(["A"], dtype="string"),
                    "geography_level": pd.Series(["commune"], dtype="string"),
                    "year": pd.Series([2018], dtype="Int64"),
                    "dispositif": pd.Series(["filosofi"], dtype="string"),
                    "source_generation": pd.Series(["historical"], dtype="string"),
                    "indicator_source": pd.Series(["official_insee"], dtype="string"),
                    "is_official": pd.Series([True], dtype="boolean"),
                    "methodology_version": pd.Series(["filosofi_v1"], dtype="string"),
                    "comparable_with_previous_years": pd.Series([True], dtype="boolean"),
                    "median_income": pd.Series([22000.0], dtype="Float64"),
                    "d1_income": pd.Series([12000.0], dtype="Float64"),
                    "d2_income": pd.Series([15000.0], dtype="Float64"),
                    "d3_income": pd.Series([18000.0], dtype="Float64"),
                    "d4_income": pd.Series([20000.0], dtype="Float64"),
                    "d5_income": pd.Series([pd.NA], dtype="Float64"),
                    "d6_income": pd.Series([26000.0], dtype="Float64"),
                    "d7_income": pd.Series([29000.0], dtype="Float64"),
                    "d8_income": pd.Series([33000.0], dtype="Float64"),
                    "d9_income": pd.Series([39000.0], dtype="Float64"),
                    "poverty_rate": pd.Series([14.5], dtype="Float64"),
                    "tax_households": pd.Series([10.0], dtype="Float64"),
                    "population": pd.Series([25.0], dtype="Float64"),
                }
            ),
            2018,
            "filosofi",
        )

        availability = build_indicator_availability_payload(
            [commune_2017, commune_2023],
            [department_2017],
            [department_derived],
        )
        self.assertFalse(availability["2017"]["commune"]["d2_income"]["available"])
        self.assertFalse(availability["2023"]["commune"]["d1_income"]["available"])
        self.assertTrue(availability["2023"]["commune"]["median_income"]["available"])
        self.assertFalse(availability["2018"]["department_derived"]["median_income"]["official"])

        metadata = build_metadata_payload(
            [commune_2017, commune_2023],
            [department_2017],
            [department_derived],
        )
        self.assertIn(2022, metadata["missing_years"])
        self.assertEqual(metadata["methodology_breaks"][0]["year"], 2023)
        self.assertEqual(metadata["methodology_breaks"][0]["label"], "Passage à FiLoSoFi 2")

        self.assertEqual(
            metadata["datasets"]["commune_all_years"],
            "gold/filosofi/commune_all_years.parquet",
        )
        self.assertEqual(
            metadata["datasets"]["department_official_all_years"],
            "gold/filosofi/department_official/department_all_years.parquet",
        )
        self.assertEqual(
            metadata["datasets"]["indicator_availability"],
            "gold/filosofi/indicator_availability.json",
        )

    def test_harmonized_schema_is_stable_and_unique(self) -> None:
        frame_2018 = build_commune_frame(
            pd.DataFrame(
                {
                    "commune_code": ["01001"],
                    "commune_name": ["A"],
                    "median_income": [22000.0],
                    "d1_income": [12000.0],
                    "d2_income": [15000.0],
                    "d3_income": [18000.0],
                    "d4_income": [20000.0],
                    "d6_income": [26000.0],
                    "d7_income": [29000.0],
                    "d8_income": [33000.0],
                    "d9_income": [39000.0],
                    "poverty_rate": [14.5],
                    "tax_households": [10.0],
                    "population": [25.0],
                }
            ),
            2018,
            "filosofi",
            "historical",
            self.mapping,
        )
        frame_2023 = build_commune_frame(
            pd.DataFrame(
                {
                    "commune_code": ["01002"],
                    "commune_name": [""],
                    "median_income": [23000.0],
                    "poverty_rate": [10.2],
                }
            ),
            2023,
            "filosofi2",
            "filosofi2",
            self.mapping,
        )

        self.assertEqual(frame_2018.dtypes.astype(str).to_dict(), frame_2023.dtypes.astype(str).to_dict())
        combined = pd.concat([frame_2018, frame_2023], ignore_index=True)
        self.assertEqual(int(combined.duplicated(["geography_code", "year"]).sum()), 0)

    def test_schema_report_years_follow_catalog_available_years(self) -> None:
        self.assertEqual(available_catalog_years(), [2017, 2018, 2019, 2020, 2021, 2023])

    def test_methodology_breaks_follow_catalog_configuration(self) -> None:
        self.assertEqual(
            methodology_breaks_from_catalog(),
            [
                {
                    "year": 2023,
                    "label": "Passage à FiLoSoFi 2",
                    "comparable_to_previous_year": False,
                }
            ],
        )

    def test_schema_report_year_constant_has_been_removed(self) -> None:
        self.assertFalse(hasattr(build_gold, "SCHEMA_REPORT_YEARS"))

    def test_row_level_comparability_comes_from_catalog_flags(self) -> None:
        self.assertFalse(row_level_comparability(2017, "commune", "official_insee", "filosofi"))
        self.assertTrue(row_level_comparability(2018, "commune", "official_insee", "filosofi"))
        self.assertFalse(row_level_comparability(2023, "commune", "official_insee", "filosofi2"))

    def test_available_years_include_disabled_year_when_catalog_contains_it(self) -> None:
        payload = {
            "dataset": "filosofi",
            "default_year": 2023,
            "known_missing_years": [2022],
            "sources": {
                "2017": {"enabled": True, "source_type": "data_gouv", "pipeline_mode": "full_pipeline"},
                "2023": {
                    "enabled": True,
                    "source_type": "insee_filosofi2_multigeography",
                    "pipeline_mode": "full_pipeline",
                    "methodological_break": True,
                    "methodological_break_label": "Passage à FiLoSoFi 2",
                },
                "2025": {"enabled": False, "source_type": "future_source", "pipeline_mode": "full_pipeline"},
            },
        }
        path = self.write_catalog(payload)

        with mock.patch.object(build_gold, "FILOSOFI_CONFIG_PATH", path):
            self.assertEqual(available_catalog_years(), [2017, 2023, 2025])

    def test_catalog_driven_breaks_accept_new_year_without_code_change(self) -> None:
        payload = {
            "dataset": "filosofi",
            "default_year": 2023,
            "known_missing_years": [2022],
            "sources": {
                "2023": {
                    "enabled": True,
                    "source_type": "insee_filosofi2_multigeography",
                    "pipeline_mode": "full_pipeline",
                    "methodological_break": True,
                    "methodological_break_label": "Passage à FiLoSoFi 2",
                },
                "2025": {
                    "enabled": False,
                    "source_type": "future_source",
                    "pipeline_mode": "full_pipeline",
                    "methodological_break": True,
                    "methodological_break_label": "Nouvelle rupture test",
                },
            },
        }
        path = self.write_catalog(payload)

        with mock.patch.object(build_gold, "FILOSOFI_CONFIG_PATH", path):
            self.assertEqual(
                methodology_breaks_from_catalog(),
                [
                    {
                        "year": 2023,
                        "label": "Passage à FiLoSoFi 2",
                        "comparable_to_previous_year": False,
                    },
                    {
                        "year": 2025,
                        "label": "Nouvelle rupture test",
                        "comparable_to_previous_year": False,
                    },
                ],
            )

    def test_schema_report_uses_available_years_from_catalog(self) -> None:
        payload = {
            "dataset": "filosofi",
            "default_year": 2023,
            "known_missing_years": [2022],
            "sources": {
                "2017": {"enabled": True, "source_type": "data_gouv", "pipeline_mode": "full_pipeline"},
                "2023": {
                    "enabled": True,
                    "source_type": "insee_filosofi2_multigeography",
                    "pipeline_mode": "full_pipeline",
                    "methodological_break": True,
                    "methodological_break_label": "Passage à FiLoSoFi 2",
                },
                "2025": {"enabled": False, "source_type": "future_source", "pipeline_mode": "full_pipeline"},
            },
        }
        path = self.write_catalog(payload)
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        report_dir = Path(temp_dir.name)

        with mock.patch.object(build_gold, "FILOSOFI_CONFIG_PATH", path), \
            mock.patch.object(build_gold, "REPORTS_DIR", report_dir):
            write_schema_report()

        report = pd.read_csv(report_dir / "filosofi_schema_comparison.csv")
        self.assertIn("2017_column", report.columns)
        self.assertIn("2023_column", report.columns)
        self.assertIn("2025_column", report.columns)


if __name__ == "__main__":
    unittest.main()
