from __future__ import annotations

import unittest

from data.scripts.download_filosofi import select_resource


class FiLoSoFiDownloaderTests(unittest.TestCase):
    def test_select_resource_picks_requested_year(self) -> None:
        resources = [
            {
                "title": "Revenus et pauvreté des ménages en 2018",
                "format": "xlsx",
                "last_modified": "2019-01-01T00:00:00Z",
                "url": "https://example.test/2018.xlsx",
            },
            {
                "title": "Revenus et pauvreté des ménages en 2023",
                "format": "csv",
                "last_modified": "2024-01-01T00:00:00Z",
                "url": "https://example.test/2023.csv",
            },
        ]

        selected = select_resource(resources, 2023)

        self.assertEqual(selected["title"], "Revenus et pauvreté des ménages en 2023")

    def test_missing_2022_is_not_required(self) -> None:
        resources = [
            {
                "title": "Revenus et pauvreté des ménages en 2021",
                "format": "csv",
                "last_modified": "2022-01-01T00:00:00Z",
                "url": "https://example.test/2021.csv",
            },
            {
                "title": "Revenus et pauvreté des ménages en 2023",
                "format": "csv",
                "last_modified": "2024-01-01T00:00:00Z",
                "url": "https://example.test/2023.csv",
            },
        ]

        selected = select_resource(resources, 2021)

        self.assertEqual(selected["title"], "Revenus et pauvreté des ménages en 2021")


if __name__ == "__main__":
    unittest.main()
