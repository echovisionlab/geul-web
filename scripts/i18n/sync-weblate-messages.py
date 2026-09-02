#!/usr/bin/env python3
"""Synchronize messages/*.json to Weblate with replace uploads.

The local message files are treated as the source of truth. The script logs each
network/diff/upload step so that another agent can see where a sync stopped.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCAL_MESSAGES_DIR = REPO_ROOT / "messages"
WEBLATE_BASE_URL = os.environ.get("WEBLATE_BASE_URL", "https://translate.example.invalid").rstrip("/")
WEBLATE_COMPONENT_PATH = os.environ.get("WEBLATE_COMPONENT_PATH", "geul/web-ui-messages").strip("/")
WEBLATE_TRANSLATIONS_URL = (
    f"{WEBLATE_BASE_URL}/api/components/{WEBLATE_COMPONENT_PATH}/translations/"
)


@dataclass(frozen=True)
class LocaleDiff:
    locale: str
    local_only: list[str]
    remote_only: list[str]
    changed_values: list[str]

    @property
    def has_diff(self) -> bool:
        return bool(self.local_only or self.remote_only or self.changed_values)

    @property
    def has_value_drift(self) -> bool:
        return bool(self.changed_values)


def log(message: str) -> None:
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    print(f"[weblate-sync {stamp}] {message}", flush=True)


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key] = value.strip().strip('"').strip("'")

    return values


def get_weblate_token() -> str:
    token = os.environ.get("WEBLATE_API_TOKEN") or load_dotenv(REPO_ROOT / ".env").get(
        "WEBLATE_API_TOKEN"
    )
    if not token:
        raise SystemExit("WEBLATE_API_TOKEN is required in the environment or repo-root .env")
    return token


def flatten_message_tree(value: Any, prefix: str = "") -> dict[str, Any]:
    if not isinstance(value, dict):
        return {prefix: value}

    flattened: dict[str, Any] = {}
    for key, child in value.items():
        child_prefix = f"{prefix}.{key}" if prefix else key
        flattened.update(flatten_message_tree(child, child_prefix))
    return flattened


def request_json(url: str, token: str, timeout: int) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Token {token}",
            "Connection": "close",
        },
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def multipart_form_body(
    fields: dict[str, str],
    files: list[tuple[str, str, str, bytes]],
) -> tuple[str, bytes]:
    boundary = f"----weblate-upload-{uuid4().hex}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        chunks.append(value.encode())
        chunks.append(b"\r\n")

    for name, filename, content_type, data in files:
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        chunks.append(f"Content-Type: {content_type}\r\n\r\n".encode())
        chunks.append(data)
        chunks.append(b"\r\n")

    chunks.append(f"--{boundary}--\r\n".encode())
    return boundary, b"".join(chunks)


def replace_upload(url: str, token: str, locale_path: Path, timeout: int) -> int:
    boundary, body = multipart_form_body(
        {"method": "replace"},
        [("file", locale_path.name, "application/json", locale_path.read_bytes())],
    )
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Accept": "application/json",
            "Authorization": f"Token {token}",
            "Connection": "close",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        status = response.status
        # Weblate response body is not needed for this workflow. Avoid depending
        # on response shape; closing the context is enough to finish the request.
        return status


def local_locale_files() -> list[Path]:
    return sorted(LOCAL_MESSAGES_DIR.glob("*.json"))


def fetch_remote_file_urls(token: str, timeout: int) -> dict[str, str]:
    log("fetching Weblate translation file URLs")
    payload = request_json(WEBLATE_TRANSLATIONS_URL, token, timeout)
    urls: dict[str, str] = {}

    for item in payload["results"]:
        language_code = item["language_code"]
        local_code = language_code.replace("_", "-")
        if (LOCAL_MESSAGES_DIR / f"{local_code}.json").exists():
            urls[local_code] = item["file_url"]

    return urls


def compare_locale(locale: str, remote_file_url: str, token: str, timeout: int) -> LocaleDiff:
    local_path = LOCAL_MESSAGES_DIR / f"{locale}.json"
    local_flat = flatten_message_tree(json.loads(local_path.read_text()))
    remote_flat = flatten_message_tree(request_json(remote_file_url, token, timeout))
    local_keys = set(local_flat)
    remote_keys = set(remote_flat)

    return LocaleDiff(
        locale=locale,
        local_only=sorted(local_keys - remote_keys),
        remote_only=sorted(remote_keys - local_keys),
        changed_values=sorted(
            key for key in local_keys & remote_keys if local_flat[key] != remote_flat[key]
        ),
    )


def summarize_diff(diff: LocaleDiff) -> str:
    return (
        f"{diff.locale}: "
        f"local_only={len(diff.local_only)} "
        f"remote_only={len(diff.remote_only)} "
        f"changed_values={len(diff.changed_values)}"
    )


def log_diff_details(diff: LocaleDiff, sample_size: int) -> None:
    for label, keys in (
        ("local_only", diff.local_only),
        ("remote_only", diff.remote_only),
        ("changed_values", diff.changed_values),
    ):
        if keys:
            sample = ", ".join(keys[:sample_size])
            suffix = " ..." if len(keys) > sample_size else ""
            log(f"{diff.locale} {label}: {sample}{suffix}")


def run(args: argparse.Namespace) -> int:
    token = get_weblate_token()
    remote_file_urls = fetch_remote_file_urls(token, args.timeout)
    locales = [path.stem for path in local_locale_files()]

    missing_urls = sorted(set(locales) - set(remote_file_urls))
    if missing_urls:
        raise SystemExit(f"Weblate file URL not found for locales: {', '.join(missing_urls)}")

    log(f"preflight diff started for {len(locales)} locales")
    preflight_diffs = [
        compare_locale(locale, remote_file_urls[locale], token, args.timeout) for locale in locales
    ]

    for diff in preflight_diffs:
        log(f"preflight {summarize_diff(diff)}")
        log_diff_details(diff, args.sample_size)

    value_drift = [diff for diff in preflight_diffs if diff.has_value_drift]
    if value_drift and not (args.check or args.allow_value_drift):
        log("aborting because shared keys have different values")
        log("rerun with --allow-value-drift only when local files intentionally replace Weblate")
        return 1

    if args.check:
        if any(diff.has_diff for diff in preflight_diffs):
            log("check finished: local and Weblate differ")
            return 1
        log("check finished: local and Weblate are identical")
        return 0

    log("replace upload started")
    for locale in locales:
        local_path = LOCAL_MESSAGES_DIR / f"{locale}.json"
        log(f"uploading {locale} with method=replace")
        status = replace_upload(remote_file_urls[locale], token, local_path, args.timeout)
        log(f"uploaded {locale}: http_status={status}")

    log("postflight diff started")
    postflight_diffs = [
        compare_locale(locale, remote_file_urls[locale], token, args.timeout) for locale in locales
    ]
    for diff in postflight_diffs:
        log(f"postflight {summarize_diff(diff)}")
        log_diff_details(diff, args.sample_size)

    if any(diff.has_diff for diff in postflight_diffs):
        log("sync failed: Weblate and local files still differ after upload")
        return 1

    log("sync finished: Weblate and local files are identical")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Replace-upload messages/*.json to Weblate and verify the result.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Only compare local files against Weblate; do not upload.",
    )
    parser.add_argument(
        "--allow-value-drift",
        action="store_true",
        help="Allow replace upload when existing shared keys have different values.",
    )
    parser.add_argument("--timeout", type=int, default=90, help="HTTP timeout in seconds.")
    parser.add_argument(
        "--sample-size",
        type=int,
        default=12,
        help="Maximum key-path samples to log for each diff category.",
    )
    return parser.parse_args()


def main() -> None:
    try:
        raise SystemExit(run(parse_args()))
    except urllib.error.HTTPError as error:
        log(f"http error: status={error.code} reason={error.reason}")
        raise SystemExit(1) from error
    except urllib.error.URLError as error:
        log(f"network error: {error.reason}")
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
