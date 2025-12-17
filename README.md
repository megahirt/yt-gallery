# Family Video Gallery

A private, family-friendly video gallery for unlisted YouTube videos. Built with SvelteKit, Skeleton UI, and Tailwind CSS.

## Features

- 📺 Browse unlisted YouTube videos in a responsive grid
- 🔍 Search across titles, descriptions, tags, and playlists
- 🏷️ Filter by playlist
- 🛠️ Admin page with YouTube Studio edit links
- 🔄 Automatic data refresh via GitHub Actions

## Development

### Prerequisites

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Type checking

```bash
npm run check
```

## Deployment

The site deploys automatically to GitHub Pages on push to `main`.

### Required GitHub Secrets

To enable automatic video data refresh, add these secrets to your repository:

- `YOUTUBE_API_KEY` - Your YouTube Data API v3 key
- `YOUTUBE_CHANNEL_ID` - The channel ID containing your videos

### Manual Data Refresh

1. Go to Actions → "Refresh Video Data" → "Run workflow"
2. Or trigger via repository_dispatch event

## Project Structure

```
├── src/
│   ├── lib/
│   │   ├── components/    # Svelte components
│   │   └── types.ts       # TypeScript interfaces
│   └── routes/
│       ├── +page.svelte   # Main gallery
│       └── admin/         # Admin page
├── static/
│   └── videos.json        # Video metadata (generated)
├── scripts/
│   └── fetch-videos.js    # YouTube API fetch script
└── .github/workflows/
    ├── deploy.yml         # Build & deploy to GitHub Pages
    └── refresh-videos.yml # Refresh video data from YouTube
```

## License

MIT
