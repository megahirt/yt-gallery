"""
Exports video metadata to a CSV for bulk-editing recording dates.

Reads videos.json and writes recording_dates.csv with columns:
  video_id, title, upload_date, year, month, day, description

Fill in as much of year/month/day as you know — month and day are optional.
Run `uv run set_recording_dates.py` to push the dates to YouTube.

Videos that already have a recording date set will be pre-filled.
"""

import csv
import json
from pathlib import Path

HERE = Path(__file__).parent
VIDEOS_FILE = HERE / "videos.json"
OUTPUT_FILE = HERE / "recording_dates.csv"

FIELDNAMES = ["video_id", "title", "upload_date", "year", "month", "day", "description"]


def build_rows(videos):
    rows = []
    for v in sorted(videos, key=lambda x: x["uploadDate"]):
        video_date = v.get("videoDate") or ""
        year = month = day = ""
        if video_date:
            parts = video_date[:10].split("-")  # YYYY-MM-DD
            year = parts[0] if len(parts) > 0 else ""
            month = parts[1] if len(parts) > 1 else ""
            day = parts[2] if len(parts) > 2 else ""
        rows.append({
            "video_id": v["id"],
            "title": v["title"],
            "upload_date": v["uploadDate"][:10],
            "year": year,
            "month": month,
            "day": day,
            "description": v.get("description", ""),
        })
    return rows


def main():
    if not VIDEOS_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {VIDEOS_FILE}\n"
            "Run `uv run fetch_videos.py` and `uv run make_simple_video_list.py` first."
        )

    videos = json.loads(VIDEOS_FILE.read_text())
    rows = build_rows(videos)

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    filled = sum(1 for r in rows if r["year"])
    print(f"Wrote {len(rows)} videos → {OUTPUT_FILE}")
    print(f"  {filled} already have a recording date, {len(rows) - filled} are blank")
    print()
    print("Next steps:")
    print("  1. Open recording_dates.csv in a spreadsheet")
    print("  2. Fill in year (required), month and day are optional")
    print("  3. Run `uv run set_recording_dates.py` to push dates to YouTube")


if __name__ == "__main__":
    main()
