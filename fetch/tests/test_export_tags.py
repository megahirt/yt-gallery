"""
Unit tests for export_tags.py.
"""

import csv
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from export_tags import build_rows, main, FIELDNAMES
from set_tags import parse_tags


def make_video(video_id="vid1", title="Test", upload_date="2024-03-01T14:00:00Z", tags=None):
    return {
        "id": video_id,
        "title": title,
        "uploadDate": upload_date,
        "tags": tags or [],
    }


class TestBuildRows:
    def test_basic_fields_mapped_correctly(self):
        videos = [make_video(video_id="abc", title="My Video", upload_date="2024-06-01T10:00:00Z")]
        rows = build_rows(videos)
        assert rows[0]["video_id"] == "abc"
        assert rows[0]["title"] == "My Video"
        assert rows[0]["upload_date"] == "2024-06-01"

    def test_tags_joined_comma_separated(self):
        videos = [make_video(tags=["vacation", "beach", "summer"])]
        rows = build_rows(videos)
        assert rows[0]["tags"] == "vacation, beach, summer"

    def test_empty_tags_produces_empty_string(self):
        videos = [make_video(tags=[])]
        rows = build_rows(videos)
        assert rows[0]["tags"] == ""

    def test_none_tags_produces_empty_string(self):
        videos = [make_video(tags=None)]
        rows = build_rows(videos)
        assert rows[0]["tags"] == ""

    def test_sorted_by_upload_date_oldest_first(self):
        videos = [
            make_video(video_id="new", upload_date="2024-12-01T00:00:00Z"),
            make_video(video_id="old", upload_date="2020-01-01T00:00:00Z"),
        ]
        rows = build_rows(videos)
        assert rows[0]["video_id"] == "old"
        assert rows[1]["video_id"] == "new"

    def test_upload_date_trimmed_to_date_only(self):
        videos = [make_video(upload_date="2023-07-15T12:34:56Z")]
        rows = build_rows(videos)
        assert rows[0]["upload_date"] == "2023-07-15"


class TestParseTags:
    def test_blank_returns_none(self):
        assert parse_tags("") is None
        assert parse_tags("   ") is None

    def test_dash_returns_empty_list(self):
        assert parse_tags("-") == []

    def test_single_tag(self):
        assert parse_tags("work") == ["work"]

    def test_comma_separated_tags(self):
        assert parse_tags("vacation, beach, summer") == ["vacation", "beach", "summer"]

    def test_trims_whitespace(self):
        assert parse_tags("  work ,  meeting  ") == ["work", "meeting"]

    def test_ignores_empty_segments(self):
        assert parse_tags("work,,meeting") == ["work", "meeting"]


class TestMain:
    def test_writes_csv_with_correct_headers(self, tmp_path, monkeypatch):
        import export_tags as et

        videos = [
            make_video(video_id="v1", tags=["family", "vacation"]),
            make_video(video_id="v2", tags=[]),
        ]
        videos_path = tmp_path / "videos.json"
        output_path = tmp_path / "tags.csv"
        videos_path.write_text(json.dumps(videos))

        monkeypatch.setattr(et, "VIDEOS_FILE", videos_path)
        monkeypatch.setattr(et, "OUTPUT_FILE", output_path)

        et.main()

        with output_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            assert reader.fieldnames == FIELDNAMES
            rows = list(reader)

        assert rows[0]["tags"] == "family, vacation"
        assert rows[1]["tags"] == ""

    def test_raises_if_videos_json_missing(self, tmp_path, monkeypatch):
        import export_tags as et

        monkeypatch.setattr(et, "VIDEOS_FILE", tmp_path / "videos.json")
        monkeypatch.setattr(et, "OUTPUT_FILE", tmp_path / "tags.csv")

        with pytest.raises(FileNotFoundError, match="videos.json"):
            et.main()
