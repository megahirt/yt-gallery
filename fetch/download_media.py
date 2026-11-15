"""
Downloads a low-quality local copy of every video into media/<video id>.mp4.

The copies are for analysis only (frame sampling and transcription), so 360p
is enough. For archival copies use Google Takeout instead.

Needs `yt-dlp` and `ffmpeg` on the PATH. Safe to re-run: videos already in
media/ are skipped. Private videos are skipped, since downloading them would
need a signed-in browser session.

    uv run download_media.py            # everything
    uv run download_media.py VIDEO_ID   # just these
"""

import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
VIDEOS_FULL_FILE = HERE / "videos_full.json"
MEDIA_DIR = HERE / "media"
MAX_HEIGHT = 360


def downloadable_ids(videos_full):
    """IDs of the videos that can be fetched without signing in."""
    return [v["id"] for v in videos_full if v["status"]["privacyStatus"] != "private"]


def missing_ids(video_ids, media_dir):
    """The IDs that have no finished download in media_dir yet."""
    have = {p.stem for p in media_dir.glob("*.mp4")}
    return [video_id for video_id in video_ids if video_id not in have]


def yt_dlp_command(video_ids, media_dir):
    return [
        "yt-dlp",
        # Smallest reasonable picture, in an mp4 that ffmpeg and Whisper read.
        "--format-sort", f"res:{MAX_HEIGHT},ext:mp4:m4a",
        "--merge-output-format", "mp4",
        "--output", str(media_dir / "%(id)s.%(ext)s"),
        "--no-playlist",
        "--ignore-errors",
        "--no-progress",
        # Be gentle: a pause between videos keeps YouTube from throttling.
        "--sleep-interval", "2",
        "--max-sleep-interval", "5",
        "--retries", "5",
        # Extra yt-dlp options from the environment, for whoever runs this.
        *shlex.split(os.environ.get("YT_DLP_EXTRA_ARGS", "")),
        *[f"https://www.youtube.com/watch?v={video_id}" for video_id in video_ids],
    ]


def main():
    if not VIDEOS_FULL_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {VIDEOS_FULL_FILE}\n"
            "Run `uv run fetch_videos.py` first."
        )
    MEDIA_DIR.mkdir(exist_ok=True)

    wanted = sys.argv[1:] or downloadable_ids(json.loads(VIDEOS_FULL_FILE.read_text()))
    todo = missing_ids(wanted, MEDIA_DIR)
    print(f"{len(wanted)} videos wanted, {len(wanted) - len(todo)} already in {MEDIA_DIR}")
    if not todo:
        return

    subprocess.run(yt_dlp_command(todo, MEDIA_DIR), check=False)

    still_missing = missing_ids(wanted, MEDIA_DIR)
    print(f"Downloaded {len(todo) - len(still_missing)} videos; {len(still_missing)} failed")
    for video_id in still_missing:
        print(f"  missing: {video_id}")
    if still_missing:
        sys.exit(1)


if __name__ == "__main__":
    main()
