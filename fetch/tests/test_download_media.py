import download_media as dm


def video(video_id, privacy):
    return {"id": video_id, "status": {"privacyStatus": privacy}}


class TestDownloadableIds:
    def test_skips_private_videos(self):
        videos = [video("a", "public"), video("b", "unlisted"), video("c", "private")]
        assert dm.downloadable_ids(videos) == ["a", "b"]


class TestMissingIds:
    def test_only_finished_mp4_files_count_as_downloaded(self, tmp_path):
        (tmp_path / "a.mp4").write_bytes(b"x")
        (tmp_path / "b.mp4.part").write_bytes(b"x")  # interrupted download
        (tmp_path / "c.f18.mp4.part").write_bytes(b"x")
        assert dm.missing_ids(["a", "b", "c"], tmp_path) == ["b", "c"]


class TestCommand:
    def test_one_url_per_video_and_output_named_by_id(self, tmp_path):
        command = dm.yt_dlp_command(["a", "b"], tmp_path)
        assert command[0] == "yt-dlp"
        assert command[-2:] == [
            "https://www.youtube.com/watch?v=a",
            "https://www.youtube.com/watch?v=b",
        ]
        assert str(tmp_path / "%(id)s.%(ext)s") in command
