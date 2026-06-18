from __future__ import annotations

import unittest

import pandas as pd

from data.scripts.build_filosofi_silver import (
    build_filosofi2_silver,
    build_historical_silver,
    infer_geography_level_from_frame,
    rename_columns,
)


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

    def test_build_historical_silver_merges_disp_and_poverty_sources(self) -> None:
        bronze = pd.DataFrame(
            {
                "CODGEO": ["01001", "01002", "01001", "01002"],
                "LIBGEO": ["A", "B", "A", "B"],
                "NBMEN18": ["10", "20", "", ""],
                "NBPERS18": ["25", "40", "", ""],
                "Q218": ["22000", "24000", "", ""],
                "D118": ["12000", "13000", "", ""],
                "D218": ["15000", "16000", "", ""],
                "D318": ["18000", "19000", "", ""],
                "D418": ["20000", "21000", "", ""],
                "D618": ["26000", "27000", "", ""],
                "D718": ["29000", "30000", "", ""],
                "D818": ["33000", "34000", "", ""],
                "D918": ["39000", "40000", "", ""],
                "TP6018": ["", "", "14.5", "10.2"],
                "table_id": ["disp_com", "disp_com", "disp_pauvres_com", "disp_pauvres_com"],
                "source_type": ["insee_xlsx_zip"] * 4,
                "source_file": ["disp.xlsx", "disp.xlsx", "pauvres.xlsx", "pauvres.xlsx"],
                "extracted_file": ["disp.xlsx", "disp.xlsx", "pauvres.xlsx", "pauvres.xlsx"],
            }
        )

        silver = build_historical_silver(bronze, 2018)

        self.assertEqual(len(silver), 2)
        self.assertEqual(silver["commune_code"].tolist(), ["01001", "01002"])
        self.assertEqual(silver["department_code"].tolist(), ["01", "01"])
        self.assertEqual(silver["median_income"].tolist(), [22000.0, 24000.0])
        self.assertEqual(silver["poverty_rate"].tolist(), [14.5, 10.2])
        self.assertEqual(silver["d5_income"].tolist(), [22000.0, 24000.0])

    def test_build_filosofi2_silver_pivots_commune_and_department_rows(self) -> None:
        bronze = pd.DataFrame(
            {
                "FILOSOFI_MEASURE": ["MED_SL", "PR_MD60", "MED_SL", "D1_SL"],
                "GEO": ["01001", "01001", "01", "01"],
                "GEO_OBJECT": ["COM", "COM", "DEP", "DEP"],
                "TIME_PERIOD": ["2023", "2023", "2023", "2023"],
                "OBS_VALUE": ["22000", "14.2", "25000", "14000"],
                "source_file": ["DS_FILOSOFI_CC_2023_data.csv"] * 4,
                "extracted_file": ["DS_FILOSOFI_CC_2023_data.csv"] * 4,
            }
        )

        silver = build_filosofi2_silver(bronze, 2023)

        self.assertEqual(len(silver), 2)
        commune_row = silver[silver["geography_level"] == "commune"].iloc[0]
        department_row = silver[silver["geography_level"] == "department"].iloc[0]
        self.assertEqual(commune_row["commune_code"], "01001")
        self.assertEqual(commune_row["department_code"], "01")
        self.assertEqual(commune_row["median_income"], 22000.0)
        self.assertEqual(commune_row["poverty_rate"], 14.2)
        self.assertEqual(department_row["department_code"], "01")
        self.assertEqual(department_row["median_income"], 25000.0)
        self.assertEqual(department_row["d1_income"], 14000.0)


if __name__ == "__main__":
    unittest.main()
