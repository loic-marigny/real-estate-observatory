from __future__ import annotations

import argparse
import mimetypes
import os
from pathlib import Path
from typing import Iterable

import boto3
from botocore.client import BaseClient


REQUIRED_ENV_VARS = (
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT_URL",
    "R2_BUCKET_NAME",
)
IGNORED_FILENAMES = {".DS_Store", "Thumbs.db"}


def log(message: str) -> None:
    print(f"[r2_upload] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload a local file or directory to Cloudflare R2.",
    )
    parser.add_argument(
        "--local",
        required=True,
        help="Local file or directory to upload.",
    )
    parser.add_argument(
        "--remote-prefix",
        default="",
        help="Remote key prefix, for example raw, silver, or gold.",
    )
    parser.add_argument(
        "--skip-empty",
        action="store_true",
        help="Skip empty files.",
    )
    return parser.parse_args()


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def load_r2_config() -> dict[str, str]:
    return {name: require_env(name) for name in REQUIRED_ENV_VARS}


def create_s3_client() -> tuple[BaseClient, str]:
    config = load_r2_config()

    client = boto3.client(
        "s3",
        endpoint_url=config["R2_ENDPOINT_URL"],
        aws_access_key_id=config["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=config["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    return client, config["R2_BUCKET_NAME"]


def normalize_remote_prefix(prefix: str) -> str:
    normalized = prefix.strip().strip("/")
    return normalized


def should_ignore(path: Path, skip_empty: bool) -> bool:
    if path.name in IGNORED_FILENAMES:
        return True
    if skip_empty and path.is_file() and path.stat().st_size == 0:
        return True
    return False


def iter_upload_targets(local_path: Path, skip_empty: bool) -> Iterable[tuple[Path, Path]]:
    if local_path.is_file():
        if should_ignore(local_path, skip_empty):
            return []
        return [(local_path, Path(local_path.name))]

    targets: list[tuple[Path, Path]] = []
    for path in sorted(local_path.rglob("*")):
        if not path.is_file():
            continue
        if should_ignore(path, skip_empty):
            continue
        targets.append((path, path.relative_to(local_path)))
    return targets


def build_remote_key(remote_prefix: str, relative_path: Path) -> str:
    relative_key = relative_path.as_posix()
    if not remote_prefix:
        return relative_key
    return f"{remote_prefix}/{relative_key}"


def upload_file(client: BaseClient, bucket_name: str, local_path: Path, remote_key: str) -> None:
    extra_args: dict[str, str] = {}
    guessed_type, _ = mimetypes.guess_type(local_path.name)
    if guessed_type:
        extra_args["ContentType"] = guessed_type

    log(f"Uploading {local_path} -> s3://{bucket_name}/{remote_key}")
    if extra_args:
        client.upload_file(str(local_path), bucket_name, remote_key, ExtraArgs=extra_args)
    else:
        client.upload_file(str(local_path), bucket_name, remote_key)


def main() -> None:
    args = parse_args()
    local_path = Path(args.local).resolve()
    remote_prefix = normalize_remote_prefix(args.remote_prefix)

    if not local_path.exists():
        raise SystemExit(f"Local path does not exist: {local_path}")

    try:
        client, bucket_name = create_s3_client()
    except RuntimeError as error:
        raise SystemExit(str(error)) from error

    targets = list(iter_upload_targets(local_path, args.skip_empty))
    if not targets:
        log("No files to upload.")
        return

    uploaded_keys: list[str] = []
    for source_path, relative_path in targets:
        remote_key = build_remote_key(remote_prefix, relative_path)
        upload_file(client, bucket_name, source_path, remote_key)
        uploaded_keys.append(remote_key)

    log(f"Uploaded {len(uploaded_keys)} file(s):")
    for key in uploaded_keys:
        log(f" - {key}")


if __name__ == "__main__":
    main()
