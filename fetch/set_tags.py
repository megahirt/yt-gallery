"""
Reads tags.csv and updates tags on YouTube for each row that has a
tags value filled in.

Run `uv run export_tags.py` first to generate the CSV, edit the tags
column (comma-separated), then run this script.

Blank tags cell = skip (video not touched).
Single dash (-) = clear all tags from the video.

Requires token_write.json. Generate it with: uv run login_write.py
"""

import csv
import time
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/youtube"]

HERE = Path(__file__).parent
TOKEN_FILE = HERE / "token_write.json"
INPUT_FILE = HERE / "tags.csv"


def get_credentials():
    if not TOKEN_FILE.exists():
        raise FileNotFoundError(
            f"Write token not found: {TOKEN_FILE}\n"
            "Run `uv run login_write.py` to generate it."
        )
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds.valid and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def load_rows(path):
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def parse_tags(tags_str):
    """Parse comma-separated tags. Returns [] for dash (clear), None to skip."""
    stripped = tags_str.strip()
    if not stripped:
        return None  # skip
    if stripped == "-":
        return []   # clear all tags
    return [t.strip() for t in stripped.split(",") if t.strip()]


def fetch_snippets(youtube, video_ids):
    """Batch-fetch current snippets keyed by video ID."""
    snippets = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        resp = youtube.videos().list(id=",".join(batch), part="snippet").execute()
        for item in resp.get("items", []):
            snippets[item["id"]] = item["snippet"]
    return snippets


def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {INPUT_FILE}\n"
            "Run `uv run export_tags.py` first."
        )

    rows = load_rows(INPUT_FILE)
    to_update = [
        (r, parse_tags(r.get("tags", "")))
        for r in rows
        if parse_tags(r.get("tags", "")) is not None
    ]

    if not to_update:
        print("No rows with tags filled in. Nothing to do.")
        return

    print(f"Found {len(to_update)} videos to update (out of {len(rows)} total).")
    print("Fetching current video snippets...")

    creds = get_credentials()
    youtube = build("youtube", "v3", credentials=creds)

    video_ids = [r["video_id"].strip() for r, _ in to_update]
    snippets = fetch_snippets(youtube, video_ids)

    updated = 0
    errors = 0

    for i, (row, new_tags) in enumerate(to_update, 1):
        video_id = row["video_id"].strip()
        title = row["title"]

        snippet = snippets.get(video_id)
        if not snippet:
            print(f"  [{i}/{len(to_update)}] SKIP  {title!r} — not found in API response")
            errors += 1
            continue

        snippet["tags"] = new_tags

        try:
            youtube.videos().update(
                part="snippet",
                body={"id": video_id, "snippet": snippet},
            ).execute()
            tag_display = ", ".join(new_tags) if new_tags else "(cleared)"
            print(f"  [{i}/{len(to_update)}] OK    {title!r} → {tag_display}")
            updated += 1
        except HttpError as e:
            print(f"  [{i}/{len(to_update)}] ERR   {title!r} — {e}")
            errors += 1

        if i < len(to_update):
            time.sleep(0.3)

    print(f"\nDone. {updated} updated, {errors} errors.")
    if updated:
        print("Run `uv run fetch_videos.py && uv run make_simple_video_list.py` to sync the gallery.")


if __name__ == "__main__":
    main()
