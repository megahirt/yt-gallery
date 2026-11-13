"""
Reads videos_full.json and playlists_full.json and writes a simplified videos.json.
See MAPPINGS.md for the full field mapping reference.
"""

import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
VIDEOS_FULL_FILE = HERE / "videos_full.json"
PLAYLISTS_FULL_FILE = HERE / "playlists_full.json"
OUTPUT_FILE = HERE / "videos.json"
PRIVATE_FILE = HERE / "videos_private.json"


def build_membership_lookup(playlists_full):
    """Return {video_id: [{"id": playlist_id, "title": playlist_title}, ...]}."""
    lookup = defaultdict(list)
    for m in playlists_full["memberships"]:
        lookup[m["video_id"]].append({
            "id": m["playlist_id"],
            "title": m["playlist_title"],
        })
    return lookup


_DURATION_RE = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def format_duration(iso_duration):
    """Turn a YouTube ISO 8601 duration ("PT1H2M3S") into "1:02:03" / "2:03".

    Returns None when the duration is missing or not in the expected form.
    """
    if not iso_duration:
        return None
    match = _DURATION_RE.match(iso_duration)
    if not match:
        return None
    days, hours, minutes, seconds = (int(part or 0) for part in match.groups())
    hours += days * 24
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def simplify_video(item, membership_lookup):
    video_id = item["id"]
    snippet = item["snippet"]
    status = item["status"]
    statistics = item.get("statistics", {})
    thumbnails = snippet.get("thumbnails", {})
    recording = item.get("recordingDetails", {})

    high_thumb = thumbnails.get("high")
    standard_thumb = thumbnails.get("standard") or high_thumb

    return {
        "id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": snippet["title"],
        "description": snippet.get("description", ""),
        "uploadDate": snippet["publishedAt"],
        "videoDate": recording.get("recordingDate"),
        "duration": format_duration(item.get("contentDetails", {}).get("duration")),
        "tags": snippet.get("tags", []),
        "privacyStatus": status["privacyStatus"],
        "thumbnails": {
            "high": high_thumb,
            "standard": standard_thumb,
        },
        "channelId": snippet["channelId"],
        "categoryId": snippet.get("categoryId"),
        "viewCount": statistics.get("viewCount", "0"),
        "playlists": membership_lookup.get(video_id, []),
    }


def main():
    if not VIDEOS_FULL_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {VIDEOS_FULL_FILE}\n"
            "Run `uv run fetch_videos.py` first."
        )
    if not PLAYLISTS_FULL_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {PLAYLISTS_FULL_FILE}\n"
            "Run `uv run fetch_videos.py` first."
        )

    videos_full = json.loads(VIDEOS_FULL_FILE.read_text())
    playlists_full = json.loads(PLAYLISTS_FULL_FILE.read_text())

    membership_lookup = build_membership_lookup(playlists_full)
    simplified = [simplify_video(item, membership_lookup) for item in videos_full]

    public = [v for v in simplified if v["privacyStatus"] != "private"]
    private = [v for v in simplified if v["privacyStatus"] == "private"]

    OUTPUT_FILE.write_text(json.dumps(public, indent=2))
    print(f"Wrote {len(public)} videos → {OUTPUT_FILE}")

    PRIVATE_FILE.write_text(json.dumps(private, indent=2))
    print(f"Wrote {len(private)} private videos → {PRIVATE_FILE}")


if __name__ == "__main__":
    main()
