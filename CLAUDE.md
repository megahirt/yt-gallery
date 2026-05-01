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
uv run pytest tests/             # Unit tests (mock all Google APIs)
```

### Gallery (SvelteKit)

```bash
cd gallery
npm install                      # Install dependencies
npm run dev                      # Dev server (http://localhost:5173)
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

### CI/CD

- **fetch-videos.yml**: Runs daily + manual trigger. Fetches from YouTube API, uploads `videos-json` artifact.
- **deploy.yml**: Triggered on push to main OR after successful fetch workflow. Downloads latest `videos-json` artifact, builds gallery, deploys to GitHub Pages.

## Svelte 5 Patterns

- Use `$derived.by(() => { ... })` for multi-line derivations. Use `$derived(expr)` for simple expressions where `expr` is **NOT** a function — passing a function to `$derived` (without `.by`) is a common mistake.
- Module-level reactive stores in `.svelte.ts` files use a function-factory + getters pattern (state is hidden inside the factory; getters expose it reactively).
- Cross-component sharing: `setContext('key', store)` in `+layout.svelte`, `getContext<Type>('key')` in pages.

## Key Files

- `gallery/src/lib/config.ts` — `SITE_NAME`, `SITE_SUBTITLE`
- `gallery/src/lib/stores/videos.svelte.ts` — singleton video store
- `gallery/src/lib/components/Sidebar.svelte` — collections, sort, people/places placeholders
- `gallery/src/lib/components/VideoCard.svelte` — `div[role="button"]` (NOT `<a>`), navigates to `/video/[id]`
- `gallery/src/lib/components/HeroBanner.svelte` — `static/hero.jpg` with gradient fallback
- `gallery/src/routes/video/[id]/+page.ts` — `export const prerender = false`

## E2E Tests (Playwright)

- Tests live in `gallery/tests/` (`gallery.spec.ts`, `admin.spec.ts`).
- Card selector: `.grid [role="button"]` — cards are divs with `role="button"`, not `<a>` tags.
- `mockVideos` fixture type: `ReadonlyArray<object>` (accepts `sampleVideos`, empty `[]`, or mapped arrays).
- For empty playlists in fixtures: `const x: object[] = sampleVideos.map(v => ({...v, playlists: []}))`.
- Sidebar collections via `getByRole('button', { name: 'All Videos' })` / `name: 'Birthdays'`.

## Project Management

How issues get tracked is documented in [PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md). TL;DR: I file/list/triage GitHub issues for the user via `gh`; the user does not use the GitHub web UI for issue management.

## Sensitive Files (gitignored)

`client_secret.json`, `token.json`, `videos_full.json`, `playlists_full.json`, `videos.json` — never commit these.
`gallery/static/videos.json` — local dev sample, also gitignored.
