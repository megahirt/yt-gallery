import pytest

import analyze_media as am

VOCAB = {"beach": "sand and sea", "birthday": "a party", "home": "indoors"}


class TestVocabulary:
    def test_reads_tag_lines_and_ignores_everything_else(self):
        text = "# Title\n\nSome prose.\n\n## Group\n\n- beach: sand and sea\n- snow: winter scenes\n- Not a tag\n"
        assert am.load_vocabulary(text) == {"beach": "sand and sea", "snow": "winter scenes"}

    @pytest.mark.skipif(not am.VOCABULARY_FILE.exists(), reason="needs the private catalog clone")
    def test_real_vocabulary_file_parses(self):
        vocabulary = am.load_vocabulary(am.VOCABULARY_FILE.read_text())
        assert "birthday" in vocabulary and len(vocabulary) > 20


class TestFrameTimes:
    def test_evenly_spaced_inside_the_video(self):
        assert am.frame_times(80, count=4) == [10.0, 30.0, 50.0, 70.0]

    def test_zero_length_video_still_gets_a_frame(self):
        assert am.frame_times(0) == [0.0]


class TestParseReply:
    def test_plain_json(self):
        assert am.parse_reply('{"summary": "x"}') == {"summary": "x"}

    def test_json_inside_code_fences_and_chatter(self):
        assert am.parse_reply('Here you go:\n```json\n{"tags": ["beach"]}\n```') == {"tags": ["beach"]}

    def test_cut_off_reply_keeps_the_completed_keys(self):
        reply = '```json\n{\n  "summary": "Pancakes, made fresh.",\n  "tags": ["cooking", "travel"],\n  "visible_text": "Blueberry, Banana, Blueberry, Banana, Blue'
        assert am.parse_reply(reply) == {"summary": "Pancakes, made fresh.", "tags": ["cooking", "travel"]}

    def test_no_json_raises(self):
        with pytest.raises(ValueError):
            am.parse_reply("I cannot help with that.")


class TestCleanTags:
    def test_keeps_allowed_tags_and_reports_the_rest(self):
        assert am.clean_tags(["Beach", "sunset", "home", "beach"], VOCAB) == (["beach", "home"], ["sunset"])

    def test_non_list_reply_gives_no_tags(self):
        assert am.clean_tags("beach", VOCAB) == ([], [])

    def test_caps_the_number_of_tags(self):
        vocabulary = {f"t{i}": "" for i in range(20)}
        allowed, _ = am.clean_tags(list(vocabulary), vocabulary)
        assert len(allowed) == am.MAX_TAGS


class TestPrompt:
    def test_includes_what_is_known_and_the_allowed_tags(self):
        video = {"title": "Lake Trip Day 1", "description": "", "uploadDate": "2022-12-20T00:00:00Z",
                 "playlists": [{"id": "p", "title": "Lake Trip 2022"}]}
        prompt = am.build_prompt(video, "we are at the beach", VOCAB, 8)
        assert "Lake Trip Day 1" in prompt and "Lake Trip 2022" in prompt
        assert "we are at the beach" in prompt
        assert "- beach: sand and sea" in prompt

    def test_empty_transcript_is_marked(self):
        prompt = am.build_prompt({"title": "t"}, "", VOCAB, 8)
        assert "(no speech found)" in prompt


class TestPickPilot:
    def test_covers_every_site_and_only_downloaded_videos(self):
        videos = [{"id": f"f{i}", "uploadDate": f"20{10 + i % 15}-01-01", "site": "family"} for i in range(60)]
        videos += [{"id": f"w{i}", "uploadDate": f"2015-01-{i + 1:02d}", "site": "work"} for i in range(8)]
        available = {v["id"] for v in videos} - {"f0"}
        picked = am.pick_pilot(videos, available, size=20)
        assert len(picked) == len(set(picked)) <= 20
        assert "f0" not in picked
        assert any(i.startswith("w") for i in picked) and any(i.startswith("f") for i in picked)
