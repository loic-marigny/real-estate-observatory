from __future__ import annotations

import csv
import io
import json
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from unittest import mock
import unittest

from openpyxl import Workbook

from data.scripts import download_filosofi


def create_fake_workbook_bytes(sheet_names: list[str] | None = None) -> bytes:
    workbook = Workbook()
    default_sheet = workbook.active
    default_sheet.title = (sheet_names or ["Sommaire"])[0]
    default_sheet["A1"] = "Fichier Localise Social et Fiscal (FiLoSoFi) - Annee 2020"
    default_sheet["A2"] = "Sommaire"
    default_sheet["A3"] = "Mise en ligne le 23/01/2023       Geographie au 01/01/2021"
    default_sheet["A6"] = "Pour acceder a une feuille Excel"
    for extra_sheet in (sheet_names or ["Sommaire", "ENSEMBLE", "Variables", "Documentation générale", "Seuils"])[1:]:
        workbook.create_sheet(extra_sheet)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def create_zip_bytes(file_names: list[str], workbook_sheet_names: list[str] | None = None) -> bytes:
    workbook_bytes = create_fake_workbook_bytes(workbook_sheet_names)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for file_name in file_names:
            archive.writestr(file_name, workbook_bytes)
    return buffer.getvalue()


def create_filosofi2_zip_bytes() -> bytes:
    data_rows = [
        ["FILOSOFI_MEASURE", "GEO", "GEO_OBJECT", "UNIT_MEASURE", "CONF_STATUS", "OBS_STATUS", "UNIT_MULT", "TIME_PERIOD", "OBS_VALUE"],
        ["MED_SL", "01001", "COM", "EUR", "F", "O", "0", "2023", "22000"],
        ["PR_MD60", "01", "DEP", "PT", "F", "O", "0", "2023", "14.2"],
    ]
    metadata_rows = [
        ["COD_VAR", "LIB_VAR", "COD_MOD", "LIB_MOD", "GEO_OBJECT"],
        ["GEO_OBJECT", "Niveau geographique", "COM", "Commune", ""],
    ]
    data_buffer = io.StringIO()
    metadata_buffer = io.StringIO()
    data_writer = csv.writer(data_buffer, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\n")
    metadata_writer = csv.writer(metadata_buffer, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\n")
    data_writer.writerows(data_rows)
    metadata_writer.writerows(metadata_rows)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as archive:
        archive.writestr("DS_FILOSOFI_CC_2023_data.csv", data_buffer.getvalue().encode("utf-8-sig"))
        archive.writestr("DS_FILOSOFI_CC_2023_metadata.csv", metadata_buffer.getvalue().encode("utf-8-sig"))
    return zip_buffer.getvalue()


class FakeResponse:
    def __init__(self, payload: bytes, content_type: str, url: str):
        self.payload = payload
        self.headers = {"content-type": content_type}
        self.url = url

    def raise_for_status(self) -> None:
        return None

    def iter_content(self, chunk_size: int = 1024 * 1024):
        for index in range(0, len(self.payload), chunk_size):
            yield self.payload[index : index + chunk_size]

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


class FiLoSoFiDownloaderTests(unittest.TestCase):
    def test_select_resource_ignores_non_tabular_javascript_resource(self) -> None:
        resources = [
            {
                "title": "Revenus et pauvreté des ménages en 2017",
                "format": "",
                "url": "https://cdn.matomo.cloud/insee.matomo.cloud/container_j86K86K5.js",
                "latest": "",
                "last_modified": "2025-01-01T00:00:00+00:00",
            },
            {
                "title": "Revenus et pauvreté des ménages en 2017",
                "format": "xlsx",
                "url": "https://example.test/filosofi_2017.xlsx",
                "latest": "",
                "last_modified": "2024-01-01T00:00:00+00:00",
            },
        ]

        selected = download_filosofi.select_resource(resources, 2017)

        self.assertEqual(selected["url"], "https://example.test/filosofi_2017.xlsx")

    def test_validate_year_specific_xlsx_zip_accepts_realistic_members(self) -> None:
        file_names = [
            "FILO2018_DEC_COM.xlsx",
            "FILO2018_DEC_Pauvres_COM.xlsx",
            "FILO2018_DISP_COM.xlsx",
            "FILO2018_DISP_Pauvres_COM.xlsx",
            "FILO2018_TRDECILES_DEC_COM.xlsx",
            "FILO2018_TRDECILES_DISP_COM.xlsx",
        ]
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = Path(temp_dir) / "2018.zip"
            archive_path.write_bytes(create_zip_bytes(file_names))

            members = download_filosofi.validate_zip_archive(archive_path)
            validated = download_filosofi.validate_xlsx_zip_members(archive_path, members, 2018, ["DEC_COM", "DISP_COM"])

        self.assertEqual(validated, file_names)

    def test_validate_xlsx_zip_rejects_wrong_year_members(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = Path(temp_dir) / "wrong.zip"
            archive_path.write_bytes(create_zip_bytes(["FILO2018_DEC_COM.xlsx", "FILO2020_DISP_COM.xlsx"]))

            members = download_filosofi.validate_zip_archive(archive_path)
            with self.assertRaisesRegex(RuntimeError, "do not match FiLoSoFi year 2018"):
                download_filosofi.validate_xlsx_zip_members(archive_path, members, 2018, ["DEC_COM", "DISP_COM"])

    def test_validate_zip_archive_rejects_html_payload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = Path(temp_dir) / "error.zip"
            archive_path.write_text("<html><body>error</body></html>", encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "HTML"):
                download_filosofi.validate_zip_archive(archive_path)

    def test_sha256_file_returns_stable_hash(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "sample.txt"
            file_path.write_text("abc", encoding="utf-8")

            digest = download_filosofi.sha256_file(file_path)

        self.assertEqual(digest, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")

    def test_discover_filosofi2_link_prefers_csv_candidate(self) -> None:
        html = """
        <html>
          <body>
            <a href="/fr/statistiques/fichier/8984752/FILOSOFI_CC_xlsx.zip">(xlsx, 1 Mo)</a>
            <a href="/fr/statistiques/fichier/8984752/FILOSOFI_CC_csv.zip">(csv, 5 Mo)</a>
            <a href="/fr/statistiques/fichier/8984752/FILOSOFI_SAGE_LOG_TP_NIVVIE_csv.zip">(csv, 19 Ko)</a>
          </body>
        </html>
        """
        source = {
            "source_page_url": "https://www.insee.fr/fr/statistiques/8984752",
            "link_discovery": {
                "label": "Revenus et pauvreté des ménages en 2023 - Tous les niveaux géographiques",
                "preferred_format": "csv",
                "required_url_fragment": "FILOSOFI_CC_",
            },
        }

        fake_page = FakeResponse(html.encode("utf-8"), "text/html", source["source_page_url"])
        fake_page.text = html
        with mock.patch.object(download_filosofi.requests, "get", return_value=fake_page):
            discovered = download_filosofi.discover_filosofi2_link(source)

        self.assertEqual(discovered, "https://www.insee.fr/fr/statistiques/fichier/8984752/FILOSOFI_CC_csv.zip")

    def test_discover_file_url_ignores_non_tabular_links_in_html(self) -> None:
        html = """
        <html>
          <body>
            <script src="https://cdn.matomo.cloud/insee.matomo.cloud/container_j86K86K5.js"></script>
            <a href="https://example.test/files/filosofi_2017.xlsx">download</a>
          </body>
        </html>
        """
        fake_page = FakeResponse(html.encode("utf-8"), "text/html", "https://example.test/resource-page")
        fake_page.text = html

        with mock.patch.object(download_filosofi.requests, "get", return_value=fake_page):
            discovered = download_filosofi.discover_file_url("https://example.test/resource-page", "xlsx")

        self.assertEqual(discovered, "https://example.test/files/filosofi_2017.xlsx")

    def test_discover_file_url_resolves_relative_insee_download_link(self) -> None:
        html = """
        <html>
          <body>
            <a href="/fr/statistiques/fichier/4507225/base-filosofi-2017_CSV.zip">(csv, 799 Ko)</a>
            <a href="/fr/statistiques/fichier/4507225/base-filosofi-2017_XLS.zip">(xls, 3 Mo)</a>
          </body>
        </html>
        """
        fake_page = FakeResponse(html.encode("utf-8"), "text/html", "https://www.insee.fr/fr/statistiques/4507225")
        fake_page.text = html

        with mock.patch.object(download_filosofi.requests, "get", return_value=fake_page):
            discovered = download_filosofi.discover_file_url("https://www.insee.fr/fr/statistiques/4507225", "csv")

        self.assertEqual(discovered, "https://www.insee.fr/fr/statistiques/fichier/4507225/base-filosofi-2017_CSV.zip")

    def test_inspect_csv_file_rejects_html_disguised_as_csv(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "fake.csv"
            path.write_text("<html><body>error</body></html>", encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "HTML"):
                download_filosofi.inspect_csv_file(path)

    def test_inspect_csv_file_validates_filosofi2_schema(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = Path(temp_dir) / "2023.zip"
            archive_path.write_bytes(create_filosofi2_zip_bytes())
            extracted_dir = Path(temp_dir) / "extracted"
            extracted_paths = download_filosofi.extract_csv_archive(archive_path, extracted_dir)

            info = download_filosofi.inspect_csv_file(extracted_paths[0])

        self.assertEqual(info["columns"], [
            "FILOSOFI_MEASURE",
            "GEO",
            "GEO_OBJECT",
            "UNIT_MEASURE",
            "CONF_STATUS",
            "OBS_STATUS",
            "UNIT_MULT",
            "TIME_PERIOD",
            "OBS_VALUE",
        ])
        self.assertEqual(info["geo_objects"], ["COM", "DEP"])
        self.assertEqual(info["measures"], ["MED_SL", "PR_MD60"])
        self.assertEqual(info["row_count"], 2)

    def test_inspect_filosofi2_extracted_files_keeps_data_and_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = Path(temp_dir) / "2023.zip"
            archive_path.write_bytes(create_filosofi2_zip_bytes())
            extracted_dir = Path(temp_dir) / "extracted"
            extracted_paths = download_filosofi.extract_csv_archive(archive_path, extracted_dir)

            extracted_files = download_filosofi.inspect_filosofi2_extracted_files(extracted_paths)

        self.assertEqual([item["filename"] for item in extracted_files], [
            "DS_FILOSOFI_CC_2023_data.csv",
            "DS_FILOSOFI_CC_2023_metadata.csv",
        ])
        self.assertEqual(extracted_files[0]["row_count"], 2)
        self.assertEqual(extracted_files[1]["columns"], ["COD_VAR", "LIB_VAR", "COD_MOD", "LIB_MOD", "GEO_OBJECT"])

    def test_existing_valid_bronze_ingestion_is_idempotent(self) -> None:
        file_names = [
            "FILO2020_DEC_COM.xlsx",
            "FILO2020_DEC_PAUVRES_COM.xlsx",
            "FILO2020_DISP_COM.xlsx",
            "FILO2020_DISP_PAUVRES_COM.xlsx",
            "FILO2020_TRDECILES_DEC_COM.xlsx",
            "FILO2020_TRDECILES_DISP_COM.xlsx",
        ]
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = {
                "archive_filename": "indic-struct-distrib-revenu-2020-COMMUNES_XLSX.zip",
                "download_url": "https://example.test/archive.zip",
                "source_type": "insee_xlsx_zip",
            }
            archive_dir = root / "source"
            extracted_dir = root / "extracted"
            archive_dir.mkdir(parents=True, exist_ok=True)
            archive_path = archive_dir / source["archive_filename"]
            archive_path.write_bytes(create_zip_bytes(file_names))
            extracted = download_filosofi.extract_files(archive_path, extracted_dir, file_names)
            workbooks = [download_filosofi.inspect_xlsx_workbook(path) for path in extracted]
            manifest = download_filosofi.build_xlsx_zip_manifest(
                year=2020,
                source=source,
                archive_path=archive_path,
                download_metadata={"final_url": source["download_url"], "content_type": "application/zip"},
                workbooks=workbooks,
                downloaded_at=datetime.now(UTC),
            )
            manifest_path = root / "manifest.json"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

            with mock.patch.object(download_filosofi, "bronze_output_dir", return_value=root), \
                mock.patch.object(download_filosofi, "bronze_source_dir", return_value=archive_dir), \
                mock.patch.object(download_filosofi, "bronze_extracted_dir", return_value=extracted_dir), \
                mock.patch.object(download_filosofi, "bronze_manifest_path", return_value=manifest_path):
                self.assertTrue(download_filosofi.existing_bronze_ingestion_is_valid(2020, source))

    def test_force_triggers_redownload(self) -> None:
        source = {
            "archive_filename": "indic-struct-distrib-revenu-2020-COMMUNES_XLSX.zip",
            "download_url": "https://example.test/archive.zip",
            "source_type": "insee_xlsx_zip",
            "required_filename_fragments": ["DEC_COM", "DISP_COM"],
        }
        payload = create_zip_bytes([
            "FILO2020_DEC_COM.xlsx",
            "FILO2020_DEC_PAUVRES_COM.xlsx",
            "FILO2020_DISP_COM.xlsx",
            "FILO2020_DISP_PAUVRES_COM.xlsx",
            "FILO2020_TRDECILES_DEC_COM.xlsx",
            "FILO2020_TRDECILES_DISP_COM.xlsx",
        ])
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            with mock.patch.object(download_filosofi, "bronze_output_dir", return_value=root), \
                mock.patch.object(download_filosofi, "bronze_source_dir", return_value=root / "source"), \
                mock.patch.object(download_filosofi, "bronze_extracted_dir", return_value=root / "extracted"), \
                mock.patch.object(download_filosofi, "bronze_manifest_path", return_value=root / "manifest.json"), \
                mock.patch.object(download_filosofi.requests, "get", return_value=FakeResponse(payload, "application/zip", source["download_url"])) as mocked_get:
                download_filosofi.ingest_insee_xlsx_zip_bronze(2020, source, force=True)

        self.assertEqual(mocked_get.call_count, 1)


if __name__ == "__main__":
    unittest.main()
