from __future__ import annotations

import unittest

import pandas as pd

from data.scripts.dvf.build_gold import build_national_row, compute_quantile


class DvfGoldTests(unittest.TestCase):
    def test_compute_quantile_returns_deciles(self) -> None:
        series = pd.Series([1000.0, 1200.0, 1500.0, 2000.0, 2500.0, 3000.0])

        self.assertEqual(compute_quantile(series, 0.1), 1100.0)
        self.assertEqual(compute_quantile(series, 0.9), 2750.0)

    def test_national_row_contains_median_and_deciles(self) -> None:
        frame = pd.DataFrame(
            {
                "price_m2": [1000.0, 1200.0, 1500.0, 2000.0, 2500.0, 3000.0],
                "surface_reelle_bati": [30.0, 40.0, 50.0, 60.0, 70.0, 80.0],
            }
        )

        row = build_national_row(
            frame,
            2024,
            "2026-06-23T00:00:00+00:00",
            "data/silver/dvf/year=2024/dvf_silver.parquet",
        ).iloc[0]

        self.assertEqual(row["year"], 2024)
        self.assertEqual(row["total_sales_count"], 6)
        self.assertEqual(row["median_price_m2"], 1750.0)
        self.assertEqual(row["d1_price_m2"], 1100.0)
        self.assertEqual(row["d9_price_m2"], 2750.0)
        self.assertEqual(row["median_surface"], 55.0)


if __name__ == "__main__":
    unittest.main()
