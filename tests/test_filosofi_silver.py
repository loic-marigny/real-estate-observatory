from __future__ import annotations

import unittest

import pandas as pd

from data.scripts.build_filosofi_silver import infer_geography_level_from_frame, rename_columns


class FiLoSoFiSilverTests(unittest.TestCase):
    def test_infer_commune_geography_from_codgeo(self) -> None:
        frame = pd.DataFrame(
            {
                "CODGEO": ["01001", "01002", "01004"],
                "LIBGEO": ["L'Abergement-Clemenciat", "L'Abergement-de-Varey", "Ambérieu-en-Bugey"],
                "MED": ["22000", "23500", "21000"],
            }
        )

        inferred = infer_geography_level_from_frame(rename_columns(frame))

        self.assertEqual(inferred, "commune")

    def test_infer_department_geography_from_short_codes(self) -> None:
        frame = pd.DataFrame(
            {
                "CODDEP": ["01", "02", "03"],
                "MED": ["22000", "23500", "21000"],
            }
        )

        inferred = infer_geography_level_from_frame(rename_columns(frame))

        self.assertEqual(inferred, "department")


if __name__ == "__main__":
    unittest.main()
