from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from botocore.exceptions import ClientError

from data.scripts.dvf import download
from data.scripts.dvf.sources import LEGACY_DVF_FILENAME
from data.scripts.dvf.sources import resolve_existing_raw_path


class DvfDownloadTests(unittest.TestCase):
    def test_can_reuse_local_archive_detects_existing_year_partition(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            raw_root = Path(temp_dir)
            archive_path = raw_root / "year=2018" / LEGACY_DVF_FILENAME
            archive_path.parent.mkdir(parents=True, exist_ok=True)
            archive_path.write_text("stub", encoding="utf-8")

            with mock.patch("data.scripts.dvf.sources.RAW_DATA_DIR", raw_root):
                self.assertTrue(download.can_reuse_local_archive(2018))
                self.assertFalse(download.can_reuse_local_archive(2019))
                self.assertFalse(download.can_reuse_local_archive(None))

    def test_resolve_download_url_uses_legacy_direct_resource(self) -> None:
        session = mock.Mock()

        year, url = download.resolve_download_url(session, 2019)

        self.assertEqual(year, 2019)
        self.assertIn("3004168d-bec4-44d9-a781-ef16f41856a2", url)
        session.get.assert_not_called()

    def test_resolve_existing_raw_path_accepts_year_named_zip_archive(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            raw_root = Path(temp_dir)
            archive_path = raw_root / "year=2017" / "2017-full.csv.zip"
            archive_path.parent.mkdir(parents=True, exist_ok=True)
            archive_path.write_text("stub", encoding="utf-8")

            with mock.patch("data.scripts.dvf.sources.RAW_DATA_DIR", raw_root):
                self.assertEqual(resolve_existing_raw_path(2017), archive_path)

    def test_try_download_from_r2_downloads_matching_archive(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            raw_root = Path(temp_dir)
            mock_client = mock.Mock()
            mock_client.head_object.side_effect = [
                ClientError({"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject"),
                ClientError({"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject"),
                {"ResponseMetadata": {"HTTPStatusCode": 200}},
            ]

            with (
                mock.patch("data.scripts.dvf.sources.RAW_DATA_DIR", raw_root),
                mock.patch("data.scripts.dvf.download.create_s3_client", return_value=(mock_client, "bucket")),
            ):
                downloaded_path = download.try_download_from_r2(2017)

            self.assertIsNotNone(downloaded_path)
            assert downloaded_path is not None
            self.assertEqual(downloaded_path.name, "2017-full.csv.zip")
            mock_client.download_file.assert_called_once_with(
                "bucket",
                "raw/dvf/year=2017/2017-full.csv.zip",
                str(downloaded_path),
            )

    def test_try_download_from_r2_ignores_access_denied_and_falls_back(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            raw_root = Path(temp_dir)
            mock_client = mock.Mock()
            mock_client.head_object.side_effect = lambda **kwargs: (_ for _ in ()).throw(
                ClientError({"Error": {"Code": "403", "Message": "Forbidden"}}, "HeadObject")
            )

            with (
                mock.patch("data.scripts.dvf.sources.RAW_DATA_DIR", raw_root),
                mock.patch("data.scripts.dvf.download.create_s3_client", return_value=(mock_client, "bucket")),
            ):
                downloaded_path = download.try_download_from_r2(2017)

            self.assertIsNone(downloaded_path)
            mock_client.download_file.assert_not_called()


if __name__ == "__main__":
    unittest.main()
