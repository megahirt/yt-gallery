Family Video Gallery – Project Specification & Decisions Summary

Project Overview

This project is a private family-friendly video gallery that displays unlisted YouTube videos from the owner’s channel.
It will:
	•	Provide a clean, kid-friendly interface for browsing videos
	•	Allow search, filtering, and browsing by playlist/facets
	•	Include an /admin area for owner-only features like:
	•	Links to edit videos in YouTube Studio
	•	A button to refresh video metadata from YouTube
	•	Be hosted as a static site on GitHub Pages
	•	Fetch its video metadata at runtime from a JSON file

No backend server is required—only static assets + an optional serverless hook to trigger GitHub Actions.

⸻

1. Technology Stack Decisions

1.1 Framework Choice

Chosen: SvelteKit
Reasoning:
	•	SvelteKit provides excellent support for static builds (via adapter-static).
	•	The project requires rich client-side interactivity (search, filters, facets, admin interactions).
	•	Skeleton UI integrates naturally with Svelte + Tailwind.
	•	Svelte is easy to learn and expressive for UI state management.

⸻

1.2 UI Library

Chosen: Skeleton UI (with Tailwind under the hood)

Reasons:
	•	Provides polished Svelte-native UI components (buttons, inputs, cards, drawers, app shell).
	•	Still allows Tailwind utility classes for layout.
	•	Modern look and feel, designed for SvelteKit.
	•	Better fit than Tailwind-only or daisyUI due to component-driven approach.

⸻

1.3 Hosting

Chosen: GitHub Pages
	•	Site will be built as static via SvelteKit + adapter-static.
	•	Deployed automatically by GitHub Actions.
	•	Can support a custom domain (e.g., videos.hirtfamily.net).

⸻

2. Data Architecture Decisions

2.1 Video Metadata Source
	•	A single JSON file videos.json will represent all video metadata.
	•	The site fetches this JSON at runtime (NOT imported at build time).
	•	This enables updating the data without rebuilding the entire application.

Path (final):

/videos.json

This file will be placed in SvelteKit’s static/ directory so it is hosted at the root.

⸻

2.2 Updating the JSON Data

Chosen Approach: “GitHub Actions Refresh Workflow” triggered externally

Workflow Summary:
	1.	A GitHub Actions workflow (refresh-videos.yml) will:
	•	Run a Node script to call the YouTube Data API
	•	Filter for unlisted videos
	•	Generate a fresh static/videos.json
	•	Commit the file to the repo
	•	Trigger GitHub Pages redeploy
	2.	Secrets stored in GitHub:
	•	YOUTUBE_API_KEY
	•	YOUTUBE_CHANNEL_ID
	•	GITHUB_TOKEN (auto-provided)
	3.	The workflow will be triggerable in two ways:
	•	Manually via GitHub Actions UI
	•	Programmatically via repository_dispatch (see /admin below)

⸻

2.3 Admin-Side Triggering of Data Refresh

Two modes were discussed:

Mode A (simple)
	•	/admin page provides a button linking directly to the GitHub Actions “Run workflow” page.
	•	No backend needed.

Mode B (full one-click)
	•	A small serverless endpoint (Netlify, Vercel, Cloudflare Worker) holds a GitHub PAT securely.
	•	/admin calls this endpoint → endpoint triggers repository_dispatch → workflow runs.

Decision:
	•	Support Mode A first (no backend).
	•	Optionally implement Mode B later for true one-click refresh.

⸻

3. Application Architecture

3.1 Routing

Public Pages
	•	/ – Main gallery viewer
	•	Fetches /videos.json
	•	Displays grid of video cards
	•	Includes search, filtering, and playlist facets

Admin Pages
	•	/admin – Owner-only lightweight admin UI
	•	Link to YouTube Studio edit pages for each video
Format: https://studio.youtube.com/video/VIDEO_ID/edit
	•	Button to refresh YouTube data (Mode A or Mode B)
	•	Optional UI for metadata debugging or additional tools

Note: No authentication required (owner-only URL by obscurity).

⸻

3.2 Data Flow
	1.	User loads the app.
	2.	SvelteKit runtime executes:

fetch('/videos.json', { cache: 'no-store' })


	3.	Data is stored in component state.
	4.	UI filters (text search, date-range, playlist facets) filter the array in memory.
	5.	Clicking a video opens the YouTube player URL or embedded player.
	6.	In /admin, each card includes an edit link pointing to YouTube Studio.

⸻

4. UI / UX Decisions

4.1 General Look & Feel
	•	Modern, responsive layout using Skeleton UI.
	•	Video display as cards in a responsive grid.
	•	Clear typography and visual hierarchy.
	•	Kid-friendly, clean, predictable navigation.

⸻

4.2 Filters & Search

Search:
	•	Free-text search across title, description, playlist name, tags.

Faceted Filters:
	•	Playlist/category facets (based on YouTube playlists)

Optional Filters:
	•	Date range slider or pickers

All filters run client-side on the JSON data.

⸻

4.3 Video Card Structure

Each card may display:
	•	Thumbnail image
	•	Title
	•	Published date
	•	Playlist
	•	Duration (if included)
	•	Click → open embedded YouTube player or new tab

In Admin mode, card also includes:
	•	“Edit in YouTube Studio” button/link
	•	Debug or metadata preview options (optional)

⸻

5. Build & Deployment Pipeline

5.1 SvelteKit Static Build

Use adapter-static:

adapter-static

Output directory:

./build/

GitHub Pages Action will upload this.

⸻

5.2 GitHub Actions Workflows

Workflow 1: Build & Deploy

Triggered on push to main.
Steps:
	•	Install deps
	•	Run npm run build
	•	Deploy static site to GitHub Pages

Workflow 2: Refresh YouTube Data

Manually or programmatically triggered.
Steps:
	•	Checkout
	•	Run Node script to call YouTube API
	•	Generate static/videos.json
	•	Commit & push changes

⸻

6. Future Extensions (Not Yet Implemented)

These are acknowledged potential features but not decisions yet:
	•	Watch history locally in browser
	•	Allow user-generated favorites or tagging (localStorage)
	•	Offline-first mode (via service worker)
	•	Multi-user auth (Firebase, Supabase)
	•	Commenting or reactions (not planned now)

⸻

Final Summary

This project is a SvelteKit + Skeleton UI static site, deployed on GitHub Pages, that loads its data from a runtime videos.json file.
A GitHub Actions workflow refreshes that file using YouTube Data API, optionally triggered from an /admin page.
UI includes a responsive video grid, search bar, filters, playlist facets, and admin tools.

This file should give any engineer or AI agent enough context to begin implementing the application immediately.

