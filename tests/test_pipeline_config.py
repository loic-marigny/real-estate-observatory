from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.shared.pipeline_config import load_pipeline_config


class PipelineConfigTests(unittest.TestCase):
    def test_filosofi_years_include_expected_millesimes(self) -> None:
        config = load_pipeline_config()
        self.assertEqual(config["filosofi_years"], [2017, 2018, 2019, 2020, 2021, 2023])
        self.assertNotIn(2022, config["filosofi_years"])

    def test_adding_new_year_in_config_is_reflected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "pipeline_years.json"
            config_path.write_text(
                json.dumps(
                    {
                        "dvf_years": [2024],
                        "filosofi_years": [2017, 2018, 2024],
                    }
                ),
                encoding="utf-8",
            )

            config = load_pipeline_config(config_path)

        self.assertEqual(config["filosofi_years"], [2017, 2018, 2024])


if __name__ == "__main__":
    unittest.main()
