"""
Proposes metadata for videos by looking at them, entirely on this machine.

For each video in media/ it samples frames with ffmpeg, transcribes the start
of the audio with whisper.cpp, and asks a local vision model (through Ollama)
for a summary, tags from the tag list, a setting, and any date clues.
The tag list is catalog/tag_vocabulary.md, kept in the private catalog repo
because it describes the family's own videos.
Each result is written to proposals/<video id>.json, and proposals/index.html
shows them all for review. Nothing is sent to YouTube or the catalog: these
are proposals for a person to approve.

Needs ffmpeg, whisper-cli (whisper.cpp), a whisper model in models/, and
Ollama running with the vision model pulled.

    uv run analyze_media.py --pilot       # a spread of 20 downloaded videos
    uv run analyze_media.py ID [ID ...]   # just these
    uv run analyze_media.py --all         # everything in media/
    uv run analyze_media.py --report      # only rebuild proposals/index.html

Videos that already have a proposal are skipped unless --force is given.
"""

import argparse
import base64
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
MEDIA_DIR = HERE / "media"
PROPOSALS_DIR = HERE / "proposals"
VOCABULARY_FILE = HERE / "catalog" / "tag_vocabulary.md"
WHISPER_MODEL = HERE / "models" / "ggml-large-v3-turbo-q5_0.bin"
SITE_FILES = ["videos.json", "videos_work.json", "videos_other.json", "videos_private.json"]

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("ANALYZE_MODEL", "gemma4:12b")

FRAME_COUNT = 8
FRAME_WIDTH = 640
# Only the start of the audio is transcribed: enough to tell what a video is
# about without spending minutes on every long one.
MAX_AUDIO_SECONDS = 300
MAX_TRANSCRIPT_CHARS = 3000
MAX_TAGS = 6
PILOT_SIZE = 20


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def load_vocabulary(text):
    """Return {tag: description} from the `- tag: description` lines."""
    vocabulary = {}
    for line in text.splitlines():
        match = re.match(r"^- ([a-z0-9][a-z0-9-]*):\s*(.*)$", line.strip())
        if match:
            vocabulary[match.group(1)] = match.group(2)
    return vocabulary


def frame_times(duration, count=FRAME_COUNT):
    """Evenly spaced timestamps (seconds), each in the middle of its slice."""
    if duration <= 0:
        return [0.0]
    return [round(duration * (i + 0.5) / count, 2) for i in range(count)]


def build_prompt(video, transcript, vocabulary, frame_count):
    tag_lines = "\n".join(f"- {tag}: {description}" for tag, description in vocabulary.items())
    playlists = ", ".join(p["title"] for p in video.get("playlists", [])) or "(none)"
    return f"""You are cataloguing a family's video library. Below are {frame_count} frames sampled in order from one video, plus what is already known about it.

Title: {video.get("title", "")}
Existing description: {video.get("description", "").strip()[:500] or "(none)"}
Playlists: {playlists}
Uploaded: {video.get("uploadDate", "")[:10]}
Transcript of the first minutes (automatic, may be wrong or just music/noise):
{transcript.strip()[:MAX_TRANSCRIPT_CHARS] or "(no speech found)"}

Reply with one JSON object and nothing else, with these keys:
- "summary": one or two plain sentences on what happens in the video. Describe people by role (a man, two boys), never guess names from faces; use a name only if the title or transcript gives it.
- "tags": the tags from the allowed list that describe what this video is mainly about, most important first. Rules:
  - Usually 2 to 4 tags, never more than {MAX_TAGS}. If in doubt, leave a tag out.
  - A tag needs evidence you could point to: it is shown in the frames or it is the stated subject. Something only mentioned in passing in the speech does not count (a talk that mentions a beach is not "beach").
  - Read each tag's description and follow its limits. Do not use a tag as a default.
  - Tags about the kind of video (highlights, raw-footage, slideshow, ...) are optional: use one only when it clearly fits.
- "setting": a short phrase for where it takes place (e.g. "a beach", "a living room"), or "" if unclear.
- "place": a named location only if the title, description, transcript or visible text states it, else "".
- "date_clue": when this was filmed, only if you can read it in the frames (a camcorder date stamp, a caption, a banner) or someone says it in the transcript, else "". Quote what you saw or heard. Do not repeat a year from the title, and never use the upload date.
- "unsure": "" normally; otherwise one short sentence on what you could not tell from the frames and transcript (for example: the frames are too dark, or it is unclear what the event is).
- "visible_text": the most informative text you can read in the frames (titles, captions, signs, a camcorder date stamp), at most 25 words, else "". For a screen recording, give only its headings, not the contents.

Allowed tags:
{tag_lines}
"""


def parse_reply(text):
    """Extract the JSON object from the model's reply.

    The model may wrap it in code fences, and it sometimes gets stuck repeating
    itself inside one value until the reply is cut off. In that case the keys
    that were completed before the runaway value are kept.
    """
    start = text.find("{")
    if start < 0:
        raise ValueError(f"No JSON object in reply: {text[:200]!r}")
    end = text.rfind("}")
    if end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    # Cut back to the end of each earlier key/value pair until it parses.
    for match in reversed(list(re.finditer(r',\s*"[A-Za-z_]+"\s*:', text))):
        if match.start() <= start:
            break
        try:
            return json.loads(text[start:match.start()] + "}")
        except json.JSONDecodeError:
            continue
    raise ValueError(f"No JSON object in reply: {text[:200]!r}")


def clean_tags(tags, vocabulary):
    """Split the model's tags into (allowed, rejected), keeping order, no repeats."""
    allowed, rejected = [], []
    for tag in tags if isinstance(tags, list) else []:
        tag = str(tag).strip().lower()
        if tag in vocabulary and tag not in allowed:
            allowed.append(tag)
        elif tag not in vocabulary and tag not in rejected:
            rejected.append(tag)
    return allowed[:MAX_TAGS], rejected


def pick_pilot(videos, available_ids, size=PILOT_SIZE):
    """A spread across the library: every site, then evenly through upload order."""
    candidates = sorted(
        (v for v in videos if v["id"] in available_ids), key=lambda v: v["uploadDate"]
    )
    by_site = {}
    for video in candidates:
        by_site.setdefault(video.get("site", "family"), []).append(video)
    picked = []
    # Smallest site first, each with a share in proportion to its size (at
    # least 3), so that a large site cannot crowd the others out.
    for site_videos in sorted(by_site.values(), key=len):
        share = max(3, round(size * len(site_videos) / max(1, len(candidates))))
        share = min(share, len(site_videos), size - len(picked))
        if share <= 0:
            continue
        step = len(site_videos) / share
        picked += [site_videos[int(i * step)] for i in range(share)]
    return [v["id"] for v in picked[:size]]


# ---------------------------------------------------------------------------
# Tools: ffmpeg, whisper, Ollama
# ---------------------------------------------------------------------------

def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out or 0)


def extract_frames(path, times, out_dir):
    frames = []
    for index, seconds in enumerate(times):
        frame = Path(out_dir) / f"frame{index}.jpg"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", str(seconds), "-i", str(path),
             "-frames:v", "1", "-vf", f"scale={FRAME_WIDTH}:-2", "-q:v", "4", str(frame)],
            check=False,
        )
        if frame.exists() and frame.stat().st_size > 0:
            frames.append(frame)
    return frames


def transcribe(path, out_dir):
    """Transcript of the first MAX_AUDIO_SECONDS, or "" if there is no audio."""
    wav = Path(out_dir) / "audio.wav"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-t", str(MAX_AUDIO_SECONDS), "-i", str(path),
         "-vn", "-ar", "16000", "-ac", "1", str(wav)],
        check=False,
    )
    if not wav.exists() or wav.stat().st_size < 1000:
        return ""
    result = subprocess.run(
        ["whisper-cli", "-m", str(WHISPER_MODEL), "-f", str(wav), "-l", "auto", "-nt", "-np"],
        # Whisper occasionally emits bytes that are not valid UTF-8.
        capture_output=True, text=True, errors="replace", check=False,
    )
    return " ".join(result.stdout.split())


def ask_model(prompt, frames):
    body = {
        "model": MODEL,
        "stream": False,
        "think": False,
        "options": {
            "temperature": 0.2,
            # Room for the frames, the tag list and the transcript together
            # (Ollama's default context would cut the prompt short).
            "num_ctx": 8192,
            # A cap on the reply: without it the model can get stuck listing
            # on-screen text forever (seen on a screen recording full of code).
            "num_predict": 700,
        },
        "messages": [{
            "role": "user",
            "content": prompt,
            "images": [base64.b64encode(f.read_bytes()).decode() for f in frames],
        }],
    }
    request = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=240) as response:
        return json.load(response)["message"]["content"]


# ---------------------------------------------------------------------------
# One video, and the report
# ---------------------------------------------------------------------------

def analyze(video, vocabulary):
    path = MEDIA_DIR / f"{video['id']}.mp4"
    started = time.time()
    with tempfile.TemporaryDirectory() as work:
        duration = probe_duration(path)
        frames = extract_frames(path, frame_times(duration), work)
        if not frames:
            raise RuntimeError("no frames could be extracted")
        transcript = transcribe(path, work)
        transcribed = time.time()
        prompt = build_prompt(video, transcript, vocabulary, len(frames))
        reply = ask_model(prompt, frames)
        try:
            parse_reply(reply)
        except ValueError:
            # The reply was cut off or malformed; one more try usually fixes it.
            reply = ask_model(prompt, frames)
        # Keep one frame per video for the review page.
        thumb = PROPOSALS_DIR / "frames" / f"{video['id']}.jpg"
        thumb.parent.mkdir(parents=True, exist_ok=True)
        thumb.write_bytes(frames[len(frames) // 2].read_bytes())

    data = parse_reply(reply)
    tags, rejected = clean_tags(data.get("tags"), vocabulary)
    return {
        "id": video["id"],
        "title": video.get("title", ""),
        "site": video.get("site", ""),
        "model": MODEL,
        "duration_seconds": round(duration),
        "summary": str(data.get("summary", "")).strip(),
        "tags": tags,
        "rejected_tags": rejected,
        "setting": str(data.get("setting", "")).strip(),
        "place": str(data.get("place", "")).strip(),
        "visible_text": str(data.get("visible_text", "")).strip(),
        "date_clue": str(data.get("date_clue", "")).strip(),
        "unsure": str(data.get("unsure", "")).strip(),
        "transcript": transcript[:MAX_TRANSCRIPT_CHARS],
        "seconds": {
            "frames_and_transcript": round(transcribed - started, 1),
            "model": round(time.time() - transcribed, 1),
        },
    }


def write_report(videos_by_id):
    proposals = [json.loads(p.read_text()) for p in sorted(PROPOSALS_DIR.glob("*.json"))]
    proposals.sort(key=lambda p: videos_by_id.get(p["id"], {}).get("uploadDate", ""))
    esc = html.escape
    cards = []
    for p in proposals:
        video = videos_by_id.get(p["id"], {})
        tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in p["tags"])
        rejected = (
            f'<p class="warn">Dropped (not in the list): {esc(", ".join(p["rejected_tags"]))}</p>'
            if p["rejected_tags"] else ""
        )
        rows = "".join(
            f"<tr><th>{label}</th><td>{esc(value)}</td></tr>"
            for label, value in [
                ("Setting", p["setting"]), ("Place", p["place"]),
                ("Date clue", p["date_clue"]), ("Text seen", p["visible_text"]),
                ("Unsure about", p.get("unsure", "")),
            ] if value
        )
        seconds = p["seconds"]["frames_and_transcript"] + p["seconds"]["model"]
        cards.append(f"""<article>
<img src="frames/{esc(p['id'])}.jpg" alt="" loading="lazy">
<div>
<h2><a href="https://www.youtube.com/watch?v={esc(p['id'])}" target="_blank" rel="noopener">{esc(p['title'])}</a></h2>
<p class="meta">{esc(video.get('uploadDate', '')[:10])} · {esc(p['site'])} · {p['duration_seconds'] // 60}:{p['duration_seconds'] % 60:02d} · analysed in {seconds:.0f}s</p>
<p>{esc(p['summary'])}</p>
<p>{tags or '<span class="meta">no tags</span>'}</p>{rejected}
<table>{rows}</table>
<details><summary>Transcript (start)</summary><p class="meta">{esc(p['transcript']) or '(no speech found)'}</p></details>
</div></article>""")
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Video proposals</title><style>
body{{font:15px/1.45 system-ui,sans-serif;margin:0;padding:16px;background:#F5F3EF;color:#2F2A26}}
h1{{margin:0 0 4px}} article{{display:flex;flex-wrap:wrap;gap:16px;padding:14px;margin:14px 0;background:#fff;border:1px solid #D6D0C8;border-radius:10px}}
article img{{width:320px;max-width:100%;height:auto;align-self:flex-start;border-radius:6px;background:#DDD8D0}}
article div{{flex:1 1 320px;min-width:0}} h2{{font-size:17px;margin:0}} h2 a{{color:#2F2A26}}
p{{margin:6px 0}} .meta{{font-size:12.5px;color:#6B645E}} .warn{{font-size:12.5px;color:#8a3b12}}
.tag{{display:inline-block;margin:0 6px 4px 0;padding:2px 10px;border-radius:999px;background:#2F2A26;color:#F5F3EF;font-size:13px}}
table{{border-collapse:collapse;font-size:13.5px}} th{{text-align:left;font-weight:600;padding:2px 12px 2px 0;vertical-align:top;white-space:nowrap}} td{{padding:2px 0}}
details{{margin-top:6px}} summary{{cursor:pointer;font-size:13px}}
</style></head><body>
<h1>Video proposals</h1>
<p class="meta">{len(proposals)} videos · model {esc(MODEL)} · generated locally; nothing here has been applied.</p>
{''.join(cards)}
</body></html>"""
    (PROPOSALS_DIR / "index.html").write_text(page)
    return len(proposals)


def load_videos():
    videos = {}
    for name in SITE_FILES:
        path = HERE / name
        if path.exists():
            for video in json.loads(path.read_text()):
                videos[video["id"]] = video
    return videos


def main():
    # Show progress line by line even when the output goes to a log file.
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("ids", nargs="*", help="video IDs to analyse")
    parser.add_argument("--pilot", action="store_true", help=f"a spread of {PILOT_SIZE} downloaded videos")
    parser.add_argument("--all", action="store_true", help="every video in media/")
    parser.add_argument("--force", action="store_true", help="redo videos that already have a proposal")
    parser.add_argument("--report", action="store_true", help="only rebuild proposals/index.html")
    args = parser.parse_args()

    videos = load_videos()
    PROPOSALS_DIR.mkdir(exist_ok=True)
    if args.report:
        print(f"Wrote report for {write_report(videos)} proposals → {PROPOSALS_DIR / 'index.html'}")
        return

    vocabulary = load_vocabulary(VOCABULARY_FILE.read_text())
    available = {p.stem for p in MEDIA_DIR.glob("*.mp4")} & set(videos)
    if args.ids:
        ids = args.ids
    elif args.all:
        ids = sorted(available)
    elif args.pilot:
        ids = pick_pilot(list(videos.values()), available)
    else:
        parser.error("give video IDs, --pilot, --all or --report")

    failed = []
    for number, video_id in enumerate(ids, 1):
        out = PROPOSALS_DIR / f"{video_id}.json"
        if out.exists() and not args.force:
            continue
        if video_id not in available:
            print(f"[{number}/{len(ids)}] {video_id}: not downloaded, skipped")
            failed.append(video_id)
            continue
        title = videos[video_id].get("title", "")[:50]
        try:
            proposal = analyze(videos[video_id], vocabulary)
        except Exception as error:  # keep going; one bad video should not stop the batch
            print(f"[{number}/{len(ids)}] {video_id} {title}: FAILED ({error})")
            failed.append(video_id)
            continue
        out.write_text(json.dumps(proposal, indent=2, ensure_ascii=False) + "\n")
        took = proposal["seconds"]["frames_and_transcript"] + proposal["seconds"]["model"]
        print(f"[{number}/{len(ids)}] {video_id} {title}: {', '.join(proposal['tags'])} ({took:.0f}s)")

    count = write_report(videos)
    print(f"Report with {count} proposals → {PROPOSALS_DIR / 'index.html'}")
    if failed:
        print(f"{len(failed)} failed or skipped: {', '.join(failed)}")


if __name__ == "__main__":
    main()
