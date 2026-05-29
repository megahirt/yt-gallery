"""
Unit tests for export_recording_dates.py.
"""

import csv
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from export_recording_dates import build_rows, main, FIELDNAMES


def make_video(video_id="vid1", title="Test", upload_date="2024-03-01T14:00:00Z",
               video_date=None, description="A description"):
    return {
        "id": video_id,
        "title": title,
        "uploadDate": upload_date,
        "videoDate": video_date,
        "description": description,
    }


class TestBuildRows:
    def test_basic_fields_mapped_correctly(self):
        videos = [make_video(video_id="abc", title="My Video", upload_date="2024-06-01T10:00:00Z")]
        rows = build_rows(videos)
        assert len(rows) == 1
        assert rows[0]["video_id"] == "abc"
        assert rows[0]["title"] == "My Video"
        assert rows[0]["upload_date"] == "2024-06-01"

    def test_recording_date_blank_when_video_date_absent(self):
        videos = [make_video(video_date=None)]
        rows = build_rows(videos)
        assert rows[0]["recording_date"] == ""

    def test_recording_date_trimmed_to_date_only(self):
        videos = [make_video(video_date="2023-12-25T00:00:00.000Z")]
        rows = build_rows(videos)
        assert rows[0]["recording_date"] == "2023-12-25"

    def test_description_included(self):
        videos = [make_video(description="Family trip to the beach.")]
        rows = build_rows(videos)
        assert rows[0]["description"] == "Family trip to the beach."

    def test_sorted_by_upload_date_oldest_first(self):
        videos = [
            make_video(video_id="new", upload_date="2024-12-01T00:00:00Z"),
            make_video(video_id="old", upload_date="2020-01-01T00:00:00Z"),
            make_video(video_id="mid", upload_date="2022-06-15T00:00:00Z"),
        ]
        rows = build_rows(videos)
        assert [r["video_id"] for r in rows] == ["old", "mid", "new"]

    def test_empty_video_list(self):
        assert build_rows([]) == []

    def test_upload_date_trimmed_to_date_only(self):
        videos = [make_video(upload_date="2023-07-15T12:34:56Z")]
        rows = build_rows(videos)
        assert rows[0]["upload_date"] == "2023-07-15"


class TestMain:
    def test_writes_csv_with_correct_headers(self, tmp_path, monkeypatch):
        import export_recording_dates as erd

        videos = [
            make_video(video_id="v1", title="First", upload_date="2022-01-01T00:00:00Z"),
            make_video(video_id="v2", title="Second", upload_date="2023-01-01T00:00:00Z",
                       video_date="2022-12-25T00:00:00Z"),
        ]
        videos_path = tmp_path / "videos.json"
        output_path = tmp_path / "recording_dates.csv"
        videos_path.write_text(json.dumps(videos))

        monkeypatch.setattr(erd, "VIDEOS_FILE", videos_path)
        monkeypatch.setattr(erd, "OUTPUT_FILE", output_path)

        erd.main()

        with output_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            assert reader.fieldnames == FIELDNAMES
            rows = list(reader)

        assert len(rows) == 2
        assert rows[0]["video_id"] == "v1"
        assert rows[0]["recording_date"] == ""
        assert rows[1]["video_id"] == "v2"
        assert rows[1]["recording_date"] == "2022-12-25"

    def test_raises_if_videos_json_missing(self, tmp_path, monkeypatch):
        import export_recording_dates as erd

        monkeypatch.setattr(erd, "VIDEOS_FILE", tmp_path / "videos.json")
        monkeypatch.setattr(erd, "OUTPUT_FILE", tmp_path / "recording_dates.csv")

        with pytest.raises(FileNotFoundError, match="videos.json"):
            erd.main()
