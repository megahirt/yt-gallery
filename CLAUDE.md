# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family video gallery: a YouTube channel video fetcher (Python) + a static gallery UI (SvelteKit).

### Repo Structure

- `fetch/` — Python scripts for YouTube Data API v3
- `gallery/` — SvelteKit static site (Skeleton UI v4 + Tailwind CSS v4)
- `.github/workflows/` — CI/CD (fetch-videos.yml, deploy.yml)

## Commands

### Fetch pipeline (Python)

```bash
cd fetch
uv sync                          # Install dependencies
uv run login.py                  # OAuth login (local only, opens browser)
uv run fetch_videos.py           # Fetch videos + playlists from YouTube API
uv run make_simple_video_list.py # Generate simplified videos.json
uv run export_recording_dates.py # Export CSV for bulk-editing recording dates
uv run set_recording_dates.py    # Push edited recording dates back to YouTube
uv run export_tags.py            # Export CSV for bulk-editing tags
uv run set_tags.py               # Push edited tags back to YouTube
uv run pytest tests/             # Unit tests (mock all Google APIs)
```

#### Bulk-editing recording dates

Two separate tokens are used to keep write access off GitHub:

| Token | Script | Scope | Goes in GitHub Secrets? |
|---|---|---|---|
| `token.json` | `login.py` | `youtube.readonly` | Yes (`YOUTUBE_TOKEN_JSON`) |
| `token_write.json` | `login_write.py` | `youtube` (write) | **No — local only** |

Workflow:
1. `uv run login_write.py` → one-time local auth, saves `token_write.json`
2. `uv run export_recording_dates.py` → writes `recording_dates.csv` (gitignored)
3. Open the CSV in a spreadsheet; fill in `recording_date` (YYYY-MM-DD) for each video
4. `uv run set_recording_dates.py` → pushes dates to YouTube (≈0.3s per video)
5. `uv run fetch_videos.py && uv run make_simple_video_list.py` → sync the gallery

#### Bulk-editing tags

Same token setup as above (`token_write.json` required).

Workflow:
1. `uv run export_tags.py` → writes `tags.csv` (gitignored)
2. Open the CSV; edit the `tags` column (comma-separated). Blank = skip. `-` = clear all tags.
3. `uv run set_tags.py` → pushes tags to YouTube
4. `uv run fetch_videos.py && uv run make_simple_video_list.py` → sync the gallery

### Gallery (SvelteKit)

```bash
cd gallery
npm install                      # Install dependencies
npm run dev                      # Dev server (http://localhost:5173)
npm run dev:sample               # Dev server on :5174 with a generated sample library (thumbnails, dates, durations)
npm run build                    # Static build → gallery/build/
npm run preview                  # Preview production build
npm run check                    # Type check (svelte-kit sync + svelte-check)
npm run test:e2e                 # Playwright e2e tests
```

Uses `uv` for Python (3.14) and `npm` for the gallery.

## Architecture

### Fetch Pipeline

- All scripts use `Path(__file__).parent` (`HERE`) to resolve file paths relative to the script location
- `fetch_videos.py` auto-refreshes expired OAuth tokens using the refresh token in `token.json`
- Playlist memberships use "Strategy B" — iterating per-playlist rather than per-video to minimize API quota usage
- YouTube API responses are paginated in batches of 50 (API maximum); all pagination loops follow the same `nextPageToken` pattern
- `videos.json` field mappings are documented in `MAPPINGS.md`

### Gallery

- SvelteKit 5 with `adapter-static` (`fallback: '404.html'` provides an SPA shell for dynamic routes)
- `ssr = false` + `prerender = true` in `+layout.ts` — client-side SPA that fetches `/videos.json` at runtime via `fetch('/videos.json', { cache: 'no-store' })`
- Skeleton UI v4 + Tailwind CSS v4. The Cerberus theme is imported in `app.css` but is NOT activated via a `data-theme` attribute — the site uses custom CSS variables in `:root` for a pure light layout (`--gallery-bg`, `--sidebar-bg`, `--card-bg`, `--accent`, etc.)
- Layout is a **sidebar (240px) + main content**, defined in `+page.svelte` (NOT in `+layout.svelte`)
- Routes: `/` gallery, `/video/[id]` detail page, `/admin` standalone (its own layout)
- `+layout.svelte` is minimal — it loads the video store once via `$effect` and provides it via Svelte context with `setContext('videoStore', ...)`
- Dynamic route `/video/[id]/+page.ts` requires `export const prerender = false` (the `404.html` SPA shell handles routing at runtime)
- Search filters across title, description, tags, and playlist names
- Dates go through `src/lib/dates.ts`: `videoDate` is a calendar day stored as midnight UTC and must be formatted in UTC; `uploadDate` is shown in local time
- `npm run sample-data` (`scripts/make-sample-data.mjs`) writes a made-up library to `static/sample/` (gitignored); `VITE_VIDEOS_PATH` points the store at it
- Sites: every video belongs to one site (`site_for` / `SITE_TAGS` in `fetch/make_simple_video_list.py`; default `family`, tag `work` → `sil`). The pipeline writes `videos.json` for the default site and `videos_<site>.json` for the others, so a site's published data never lists another site's videos. The gallery shows everything in the file it is given; `VITE_SITE_NAME` / `VITE_SITE_SUBTITLE` override the name at build time
- Catalog: metadata YouTube has no field for lives in the private `megahirt/yt-gallery-catalog` repo (`catalog.json`, keyed by video ID), cloned to `fetch/catalog/` (gitignored; optional locally). `make_simple_video_list.py` copies only `CATALOG_FIELDS` (`site`, `people`, `places`, `summary`) into the published lists; a catalog `site` overrides the tag rule. The deploy reads it with the read-only `CATALOG_DEPLOY_KEY` secret and sets `REQUIRE_CATALOG=1`, so a missing catalog counts as a failed fetch
- The site is kept out of search engines: `noindex` meta tag in `app.html`, and `static/robots.txt` blocks `/videos.json` (pages stay crawlable so the `noindex` is seen)

### CI/CD

- **deploy.yml** is the only workflow. It runs daily, on manual trigger, and on push of a `v*` tag. Each run fetches from the YouTube API, copies `videos.json` into `gallery/static/`, builds the gallery and deploys to GitHub Pages.
- Scheduled/manual runs build the **newest `v*` tag**, not `main` — gallery code (and the fetch scripts) only go live when a release is tagged. The `github-pages` environment allows `main` and `v*` refs.
- If the YouTube fetch fails, the run redeploys with the `videos.json` from the live site and then fails, so GitHub sends a failure email (usually an expired OAuth token: `uv run login.py`, then update the `YOUTUBE_TOKEN_JSON` secret).
- A keepalive step re-enables the workflow on each scheduled run so the schedule isn't disabled after 60 days without repo activity.

## Svelte 5 Patterns

- Use `$derived.by(() => { ... })` for multi-line derivations. Use `$derived(expr)` for simple expressions where `expr` is **NOT** a function — passing a function to `$derived` (without `.by`) is a common mistake.
- Module-level reactive stores in `.svelte.ts` files use a function-factory + getters pattern (state is hidden inside the factory; getters expose it reactively).
- Cross-component sharing: `setContext('key', store)` in `+layout.svelte`, `getContext<Type>('key')` in pages.

## Key Files

- `gallery/src/lib/config.ts` — `SITE_NAME`, `SITE_SUBTITLE` (overridable with `VITE_SITE_NAME` / `VITE_SITE_SUBTITLE`)
- `gallery/src/lib/stores/videos.svelte.ts` — singleton video store
- `gallery/src/lib/components/Sidebar.svelte` — collections, sort
- `gallery/src/lib/components/VideoCard.svelte` — `div[role="button"]` (NOT `<a>`), navigates to `/video/[id]`; shows thumbnail, title, date and duration only (tags and view counts live on the detail page)
- `gallery/src/lib/components/MemorySlot.svelte` — featured video at the top of the home page ("On this day" match on `videoDate`, otherwise a random pick); hidden while searching or filtering by collection
- `gallery/src/routes/video/[id]/+page.svelte` — detail page; previous/next and "More from" use the first collection with other videos, falling back to the same year
- `gallery/src/routes/video/[id]/+page.ts` — `export const prerender = false`

## E2E Tests (Playwright)

- Tests live in `gallery/tests/` (`gallery.spec.ts`, `admin.spec.ts`).
- Card selector: `.grid [role="button"]` — cards are divs with `role="button"`, not `<a>` tags.
- `mockVideos` fixture type: `ReadonlyArray<object>` (accepts `sampleVideos`, empty `[]`, or mapped arrays).
- For empty playlists in fixtures: `const x: object[] = sampleVideos.map(v => ({...v, playlists: []}))` .
- Sidebar collections via `getByRole('button', { name: 'All Videos' })` / `name: 'Birthdays'`.
- The featured memory at the top of the home page picks a random video, so look up card titles inside the grid (`page.locator('.grid').getByText(...)`), not page-wide.
- `birthdayVid2` is in both the Birthdays and Vacations playlists.

## Project Management

How issues get tracked is documented in [PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md). TL;DR: I file/list/triage GitHub issues for the user via `gh`; the user does not use the GitHub web UI for issue management.

## Sensitive Files (gitignored)

`client_secret.json`, `token.json`, `token_write.json`, `videos_full.json`, `playlists_full.json`, `videos.json` — never commit these.
`gallery/static/videos.json` — local dev sample, also gitignored.
`recording_dates.csv`, `tags.csv` — generated by export scripts, also gitignored.
