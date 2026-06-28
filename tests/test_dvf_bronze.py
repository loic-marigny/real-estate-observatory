from __future__ import annotations

import tempfile
import unittest
import zipfile
from pathlib import Path

import pandas as pd

from data.scripts.dvf.build_bronze import normalize_chunk_columns, resolve_csv_delimiter


class DvfBronzeTests(unittest.TestCase):
    def test_normalize_chunk_columns_maps_legacy_headers_to_canonical_schema(self) -> None:
        legacy_chunk = pd.DataFrame(
            {
                "Nature mutation": ["Vente"],
                "Type local": ["Maison"],
                "Valeur fonciere": ["123456,78"],
                "Surface reelle bati": ["95"],
                "Nombre pieces principales": ["5"],
                "Surface terrain": ["250"],
                "Code departement": ["33"],
                "Code commune": ["063"],
                "Commune": ["Bordeaux"],
            }
        )

        normalized = normalize_chunk_columns(legacy_chunk)

        self.assertEqual(normalized.at[0, "nature_mutation"], "Vente")
        self.assertEqual(normalized.at[0, "type_local"], "Maison")
        self.assertEqual(normalized.at[0, "valeur_fonciere"], "123456,78")
        self.assertEqual(normalized.at[0, "surface_reelle_bati"], "95")
        self.assertEqual(normalized.at[0, "code_departement"], "33")
        self.assertEqual(normalized.at[0, "code_commune"], "33063")
        self.assertEqual(normalized.at[0, "nom_commune"], "Bordeaux")
        self.assertEqual(normalized.at[0, "latitude"], "")
        self.assertEqual(normalized.at[0, "longitude"], "")

    def test_resolve_csv_delimiter_detects_comma_inside_zip_archive(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = Path(temp_dir) / "2017-full.csv.zip"
            with zipfile.ZipFile(archive_path, "w") as zf:
                zf.writestr("2017-full.csv", "col1,col2\n1,2\n")

            self.assertEqual(resolve_csv_delimiter(archive_path), ",")


if __name__ == "__main__":
    unittest.main()
