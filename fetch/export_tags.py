"""
Exports video tags to a CSV for bulk editing.

Reads videos.json and writes tags.csv with columns:
  video_id, title, upload_date, tags

Edit the tags column (comma-separated), then run set_tags.py to push
the changes to YouTube. Leave the tags cell blank to skip a video.
Use a single dash (-) to clear all tags from a video.
"""

import csv
import json
from pathlib import Path

HERE = Path(__file__).parent
VIDEOS_FILE = HERE / "videos.json"
OUTPUT_FILE = HERE / "tags.csv"

FIELDNAMES = ["video_id", "title", "upload_date", "tags"]


def build_rows(videos):
    rows = []
    for v in sorted(videos, key=lambda x: x["uploadDate"]):
        tags = ", ".join(v.get("tags") or [])
        rows.append({
            "video_id": v["id"],
            "title": v["title"],
            "upload_date": v["uploadDate"][:10],
            "tags": tags,
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

    print(f"Wrote {len(rows)} videos → {OUTPUT_FILE}")
    print()
    print("Next steps:")
    print("  1. Open tags.csv in a spreadsheet")
    print("  2. Edit the tags column (comma-separated). Leave blank to skip.")
    print("     Use a single dash (-) to clear all tags from a video.")
    print("  3. Run `uv run set_tags.py` to push changes to YouTube")


if __name__ == "__main__":
    main()
