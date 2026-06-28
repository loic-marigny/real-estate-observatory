from __future__ import annotations

import unittest
from unittest import mock

import pandas as pd

from data.scripts.publishing import build_public_previews


class PublicPreviewTests(unittest.TestCase):
    def test_dvf_preview_uses_configured_years(self) -> None:
        frame = pd.DataFrame({"year": [2024, 2024], "value": [1, 2]})

        with mock.patch.object(
            build_public_previews,
            "load_pipeline_config",
            return_value={"dvf_years": [2017, 2018, 2019, 2020]},
        ):
            years = build_public_previews.resolve_available_years(
                "dvf",
                frame,
                "year",
                2024,
            )

        self.assertEqual(years, [2017, 2018, 2019, 2020])

    def test_non_dvf_preview_falls_back_to_years_in_frame(self) -> None:
        frame = pd.DataFrame({"year": [2023, 2021, 2023], "value": [1, 2, 3]})

        years = build_public_previews.resolve_available_years(
            "filosofi",
            frame,
            "year",
            2023,
        )

        self.assertEqual(years, [2021, 2023])


if __name__ == "__main__":
    unittest.main()
