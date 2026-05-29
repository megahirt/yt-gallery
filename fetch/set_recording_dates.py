"""
Reads recording_dates.csv and sets the recording date on each YouTube video
that has a recording_date value filled in.

Run `uv run export_recording_dates.py` first to generate the CSV, fill in the
recording_date column (YYYY-MM-DD), then run this script.

Requires a token with write scope. If you get a 403 error, re-run login.py
to get a fresh token with the full youtube scope, then update the token.
"""

import csv
import time
from datetime import date
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Full write scope — superset of youtube.readonly
SCOPES = ["https://www.googleapis.com/auth/youtube"]

HERE = Path(__file__).parent
TOKEN_FILE = HERE / "token.json"
INPUT_FILE = HERE / "recording_dates.csv"


def get_credentials():
    if not TOKEN_FILE.exists():
        raise FileNotFoundError(
            f"Token file not found: {TOKEN_FILE}\n"
            "Run `uv run login.py` locally first to generate token.json."
        )
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds.valid and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def parse_date(date_str):
    """Parse YYYY-MM-DD and return RFC 3339 string expected by the YouTube API."""
    d = date.fromisoformat(date_str.strip())
    return f"{d.isoformat()}T00:00:00.000Z"


def load_rows(path):
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {INPUT_FILE}\n"
            "Run `uv run export_recording_dates.py` first."
        )

    rows = load_rows(INPUT_FILE)
    to_update = [r for r in rows if r.get("recording_date", "").strip()]

    if not to_update:
        print("No rows with recording_date filled in. Nothing to do.")
        return

    print(f"Found {len(to_update)} videos to update (out of {len(rows)} total).")

    creds = get_credentials()
    youtube = build("youtube", "v3", credentials=creds)

    updated = 0
    errors = 0

    for i, row in enumerate(to_update, 1):
        video_id = row["video_id"].strip()
        title = row["title"]
        date_str = row["recording_date"].strip()

        try:
            recording_date = parse_date(date_str)
        except ValueError:
            print(f"  [{i}/{len(to_update)}] SKIP  {title!r} — invalid date {date_str!r} (use YYYY-MM-DD)")
            errors += 1
            continue

        try:
            youtube.videos().update(
                part="recordingDetails",
                body={
                    "id": video_id,
                    "recordingDetails": {"recordingDate": recording_date},
                },
            ).execute()
            print(f"  [{i}/{len(to_update)}] OK    {title!r} → {date_str}")
            updated += 1
        except HttpError as e:
            if e.status_code == 403:
                print(f"  [{i}/{len(to_update)}] ERR   {title!r} — 403 Forbidden")
                print()
                print("  Your token does not have write permission.")
                print("  Update login.py SCOPES to 'youtube' (already done if you pulled latest),")
                print("  delete token.json, run `uv run login.py` again, then retry.")
                return
            print(f"  [{i}/{len(to_update)}] ERR   {title!r} — {e}")
            errors += 1

        # Avoid hitting API quota limits
        if i < len(to_update):
            time.sleep(0.3)

    print(f"\nDone. {updated} updated, {errors} errors.")
    if updated:
        print("Run `uv run fetch_videos.py && uv run make_simple_video_list.py` to sync the gallery.")


if __name__ == "__main__":
    main()
