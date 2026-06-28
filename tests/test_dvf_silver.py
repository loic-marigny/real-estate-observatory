from __future__ import annotations

import unittest

import pandas as pd

from data.scripts.dvf.build_silver import transform_chunk


class DvfSilverTests(unittest.TestCase):
    def test_transform_chunk_parses_legacy_french_decimals(self) -> None:
        chunk = pd.DataFrame(
            {
                "nature_mutation": ["Vente"],
                "type_local": ["Appartement"],
                "valeur_fonciere": ["200000,50"],
                "surface_reelle_bati": ["50,0"],
                "nombre_pieces_principales": ["3"],
                "surface_terrain": [""],
                "code_departement": ["75"],
                "code_commune": ["056"],
                "nom_commune": ["Paris"],
            }
        )

        transformed, stats = transform_chunk(chunk, 2020)

        self.assertEqual(stats["rows_read"], 1)
        self.assertEqual(len(transformed), 1)
        self.assertEqual(transformed.iloc[0]["valeur_fonciere"], 200000.50)
        self.assertEqual(transformed.iloc[0]["surface_reelle_bati"], 50.0)
        self.assertEqual(transformed.iloc[0]["price_m2"], 4000.01)


if __name__ == "__main__":
    unittest.main()
