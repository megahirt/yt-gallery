# Video data plan

Plan for improving the video metadata, auto-tagging, splitting videos across
sites, and getting the remaining home videos uploaded. Written 2026-11-13 as
the outcome of a strategy discussion; nothing here is built yet.

To kick this off in a new session: "Read DATA_PLAN.md and start phase 0."

## Goals

1. Every video carries its real shoot date, not just its upload date.
2. Richer metadata: better tags, plus people, places and summaries.
3. Tagging is mostly automatic (an LLM proposes, Chris approves).
4. Each video belongs to a "site". `video.hirtfamily.net` shows family videos;
   a companion site (e.g. `sil-videos.hirtfamily.net`) shows the SIL/work ones.
5. About 300 older home videos that are not on YouTube yet get uploaded and
   categorized without it being a chore.

## Decisions already made

- **Hosting stays on GitHub Pages.** No login in front of the site. The site
  and its `videos.json` are therefore public to anyone who has the URL; we
  accept that and block search engines (phase 0).
- **No key-value data in the YouTube description.** It is visible to viewers,
  easy to corrupt, and unnecessary.
- **Shoot date uses YouTube's native `recordingDate`.** The gallery already
  reads it as `videoDate`; `export_recording_dates.py` / `set_recording_dates.py`
  already bulk-edit it.
- **Where each field lives:** if YouTube has a field for it (title,
  description, recording date, tags, playlists, privacy), YouTube is the source
  of truth. Everything else (site, people, places, AI summary, transcript,
  face data) lives in a catalog file keyed by video ID.
- **Two repos.** This repo stays public (code; Pages and Actions stay free).
  The catalog lives in a separate private repo that the deploy workflow reads.
  The private repo protects only what is never published: transcripts, face
  data, AI notes, and entries filtered off a given site.
- **Analysis runs on local files**, not through the YouTube API (the API does
  not provide the video itself).
- **AI proposes, human approves.** Nothing is written to YouTube or the catalog
  without review.
- **The 300 new videos are uploaded by hand in YouTube Studio**, as private, in
  batches. Metadata is applied afterwards by the tooling.

## Known constraints

- YouTube API quota is 10,000 units/day by default. `videos.update` costs 50
  units, so about 200 video edits a day. Verify current costs before planning
  a big push.
- API uploads are expensive in quota and, from an unaudited API project, may be
  locked private. Not verified recently; this is why uploads are manual.
- YouTube tags are limited to about 500 characters in total per video.
- An LLM will not identify family members by face. "Who is in this video"
  needs local face clustering that Chris labels once, or manual tagging.
- GitHub Pages cannot send `X-Robots-Tag` headers, so search-engine blocking
  has to be done with a meta tag and `robots.txt`.
- Chris does not have the original files for the 437 videos already uploaded.

## Phases

### Phase 0: block search engines (small)

- Add `<meta name="robots" content="noindex, nofollow">` to `gallery/src/app.html`.
- Add `gallery/static/robots.txt`. Note the trade-off: a crawler that is
  disallowed from a page never sees its `noindex` tag. Plan: allow the pages
  (so `noindex` is honored) and disallow `/videos.json`. (Thumbnails are served
  by YouTube, so there is nothing of ours to block.)
- Ship as a normal `v*` release.

### Phase 1: sites, filtered at build time

Today `work`-tagged videos are only hidden in the browser (`EXCLUDED_TAGS`), so
they are still in the published `videos.json`. Fix that here.

- Add a `site` value per video. Default `family`. Until the catalog exists,
  derive it by rule (tag `work` → `sil`).
- `make_simple_video_list.py` takes a site and writes only that site's videos.
- The gallery reads its site name, title and subtitle from build-time config,
  so the same code can build either site.
- Decide what happens to the "show excluded tags" toggle once work videos are
  no longer in the family data (probably remove it).
- Update fetch tests and the Playwright tests that depend on the `work` tag.

### Phase 2: private catalog repo

Needs Chris's go-ahead at the time, since it creates a repo and a deploy key.

- Create a private repo (name TBD, e.g. `yt-gallery-catalog`) holding
  `catalog.json`: `{ "<videoId>": { site, people, places, summary, ... } }`.
- Add a read-only deploy key to it; store the private key as a secret in this
  repo.
- `deploy.yml` gets a checkout step for the catalog before
  `make_simple_video_list.py`, which merges catalog fields into each video.
- If the catalog checkout fails, the deploy should behave like a failed fetch:
  redeploy the last good data and fail loudly.
- Document the catalog fields in `MAPPINGS.md`.

### Phase 3: local copies of the existing 437

- Pull low-quality copies (360p is enough for frame sampling and Whisper) with
  `yt-dlp` into a local, gitignored folder, named by video ID.
- Separately, Chris runs Google Takeout for the YouTube channel to get proper
  archival copies. Independent of everything else here.

### Phase 4: analysis pilot (20 videos)

Do this before building the review tool, to find out whether the proposals are
good enough to be worth a tool.

- Per video: sample frames with ffmpeg (every N seconds, or on scene change),
  transcribe locally with Whisper, read file metadata with ffprobe.
- Send frames + transcript to an LLM with a fixed tag vocabulary. Ask for:
  title, short description, tags, event type, place, and date clues (including
  burned-in camcorder date stamps on old footage).
- Agree the tag vocabulary with Chris first; start from the tags already in use.
- Pick the 20 to cover the range: phone clips, digitized tapes, long events,
  work videos.
- Output: a proposals file per video, plus a short write-up of quality and cost
  per video so Chris can decide whether to run it on everything.

### Phase 5: review tool

A local web tool (runs on Chris's machine; not deployed). A review queue, not a
blank sorting board.

- Shows each video with its current metadata next to the AI proposal.
- Accept, edit or reject per field; bulk-accept across many videos.
- Drag-and-drop into sites and collections for whatever is left over.
- Writes approved non-YouTube fields to the catalog, and approved YouTube
  fields to a pending-changes queue.
- Decide whether this extends the existing `/admin` route or is a separate app.

### Phase 6: push changes to YouTube

- A script applies the pending-changes queue (titles, descriptions, tags,
  recording dates, playlist membership) using `token_write.json`, following the
  `set_tags.py` pattern: dry-run by default, resumable, quota-aware.
- Then the usual `fetch_videos.py` + `make_simple_video_list.py` to sync.

### Phase 7: the 300 un-uploaded videos

1. Run the phase 4 analysis on the local files.
2. Review in the phase 5 tool.
3. Chris uploads them in YouTube Studio as private, in batches.
4. The tooling matches each upload to its local file by original filename and
   applies the approved metadata, then sets the final privacy (unlisted).

### Phase 8: the companion site

- GitHub Pages serves one site per repo, so the second site needs a thin second
  public repo whose workflow checks out this repo and builds with the other
  site's config, or a second host.
- Add the custom domain and DNS record.

## Open questions

- Name of the private catalog repo and of the companion site.
- People tagging: local face clustering, or manual only?
- Tag vocabulary: fixed list, or let the model suggest new tags for approval?
- Which LLM for the analysis, and the budget for a full run (decide after the
  pilot reports cost per video).
- Review tool: extend `/admin` or build a separate local app?
- Should some videos appear on both sites?
