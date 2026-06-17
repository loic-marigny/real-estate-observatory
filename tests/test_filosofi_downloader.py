from __future__ import annotations

import json
from pathlib import Path
import unittest

from data.scripts.download_filosofi import candidate_download_links, rank_download_candidate, select_resource


ROOT_DIR = Path(__file__).resolve().parents[1]


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

    def test_page_html_prefers_direct_csv_download_links(self) -> None:
        html = """
        <html>
          <body>
            <a href="/fr/statistiques/fichier/7756729/filosofi_2021.xlsx">XLSX</a>
            <a href="/fr/statistiques/fichier/7756729/filosofi_2021.csv">CSV</a>
            <a href="/fr/statistiques/7756729">Page</a>
          </body>
        </html>
        """

        candidates = candidate_download_links(html, "https://www.insee.fr/fr/statistiques/7756729")
        selected = sorted(candidates, key=lambda candidate: rank_download_candidate(candidate, ""), reverse=True)[0]

        self.assertEqual(selected["url"], "https://www.insee.fr/fr/statistiques/fichier/7756729/filosofi_2021.csv")

    def test_page_html_rejects_rpm_summary_when_filosofi_file_exists(self) -> None:
        html = """
        <html>
          <body>
            <a href="/fr/statistiques/fichier/5371275/RPM2021_D2.xlsx">Tableau RPM</a>
            <a href="/fr/statistiques/fichier/5371275/base-filosofi-2018.zip">Base FiLoSoFi 2018</a>
          </body>
        </html>
        """

        candidates = candidate_download_links(html, "https://www.insee.fr/fr/statistiques/5371275")
        selected = sorted(candidates, key=lambda candidate: rank_download_candidate(candidate, ""), reverse=True)[0]

        self.assertEqual(selected["url"], "https://www.insee.fr/fr/statistiques/fichier/5371275/base-filosofi-2018.zip")

    def test_configured_years_exclude_2022(self) -> None:
        config_path = ROOT_DIR / "config" / "filosofi_sources.json"
        payload = json.loads(config_path.read_text(encoding="utf-8"))

        self.assertEqual(payload["years"], [2017, 2018, 2019, 2020, 2021, 2023])
        self.assertNotIn(2022, payload["years"])


if __name__ == "__main__":
    unittest.main()
