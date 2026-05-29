"""
Reads recording_dates.csv and sets the recording date on each YouTube video
that has a year value filled in.

Run `uv run export_recording_dates.py` first to generate the CSV, fill in at
least the year column (month and day are optional), then run this script.

Missing month defaults to 01; missing day defaults to 01.

Requires token_write.json (write-scope token). Generate it with:
  uv run login_write.py
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
INPUT_FILE = HERE / "recording_dates.csv"


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


def build_recording_date(year, month, day):
    """Build RFC 3339 date string from year/month/day, defaulting missing parts to 01.

    Returns (date_str, display_str) or raises ValueError for invalid values.
    """
    y = year.strip()
    m = month.strip() or "01"
    d = day.strip() or "01"
    if not y:
        raise ValueError("year is required")
    # Validate by constructing; raises ValueError on bad values
    y_int = int(y)
    m_int = int(m)
    d_int = int(d)
    if not (1 <= m_int <= 12):
        raise ValueError(f"month {m!r} out of range 1-12")
    if not (1 <= d_int <= 31):
        raise ValueError(f"day {d!r} out of range 1-31")
    iso = f"{y_int:04d}-{m_int:02d}-{d_int:02d}"
    display = y if not month.strip() else (f"{y}-{m}" if not day.strip() else iso)
    return f"{iso}T00:00:00.000Z", display


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
    to_update = [r for r in rows if r.get("year", "").strip()]

    if not to_update:
        print("No rows with year filled in. Nothing to do.")
        return

    print(f"Found {len(to_update)} videos to update (out of {len(rows)} total).")

    creds = get_credentials()
    youtube = build("youtube", "v3", credentials=creds)

    updated = 0
    errors = 0

    for i, row in enumerate(to_update, 1):
        video_id = row["video_id"].strip()
        title = row["title"]

        try:
            recording_date, display = build_recording_date(
                row.get("year", ""),
                row.get("month", ""),
                row.get("day", ""),
            )
        except ValueError as e:
            print(f"  [{i}/{len(to_update)}] SKIP  {title!r} — {e}")
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
            print(f"  [{i}/{len(to_update)}] OK    {title!r} → {display}")
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
