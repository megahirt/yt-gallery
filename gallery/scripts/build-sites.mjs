// Builds every site into one folder that is deployed as a whole:
//
//   build-sites/                 the default site (family), served at /
//   build-sites/work/            the "work" site, served at /work/
//   build-sites/sites.json       the list the site switcher reads
//   build-sites/404.html         picks the right site for an unknown path
//
// Usage:
//   node scripts/build-sites.mjs                     data from ../fetch
//   node scripts/build-sites.mjs --from-live <url>   data from the deployed site
//
// The data folder holds sites.json plus one videos file per site, as written
// by fetch/make_simple_video_list.py. `--from-live` downloads the same files
// from a deployed copy first; the deploy uses it when the YouTube fetch fails.
//
// A site without videos is not built (and so not offered by the switcher),
// except the default site, which always is.

import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GALLERY = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(GALLERY, 'build-sites');
const STATIC_VIDEOS = join(GALLERY, 'static', 'videos.json');
// Each site's SvelteKit fallback page (its app shell) is published under this
// name, so that the one 404.html GitHub Pages allows can choose between them.
const SHELL = 'app-shell.html';

const args = process.argv.slice(2);
const liveIndex = args.indexOf('--from-live');
const liveUrl = liveIndex >= 0 ? args[liveIndex + 1]?.replace(/\/$/, '') : null;
if (liveIndex >= 0 && !liveUrl) throw new Error('--from-live needs the URL of the deployed site');

let dataDir = join(GALLERY, '..', 'fetch');

async function download(url, file) {
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	writeFileSync(file, await res.text());
}

async function downloadLiveData() {
	dataDir = join(GALLERY, '.live-data');
	rmSync(dataDir, { recursive: true, force: true });
	mkdirSync(dataDir, { recursive: true });
	try {
		await download(`${liveUrl}/sites.json`, join(dataDir, 'sites.json'));
	} catch {
		// A deployment from before there were several sites: only the default
		// site exists, with its videos at the root.
		await download(`${liveUrl}/videos.json`, join(dataDir, 'videos.json'));
		const count = JSON.parse(readFileSync(join(dataDir, 'videos.json'), 'utf8')).length;
		const site = { id: 'family', label: 'Family', title: 'MegaHirt Gallery', path: '', count, file: 'videos.json' };
		writeFileSync(join(dataDir, 'sites.json'), JSON.stringify([site], null, 2));
		return;
	}
	for (const site of JSON.parse(readFileSync(join(dataDir, 'sites.json'), 'utf8'))) {
		await download(`${liveUrl}${site.path}/videos.json`, join(dataDir, site.file));
	}
}

function notFoundPage(paths) {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="robots" content="noindex, nofollow" />
		<title>Loading…</title>
		<script>
			// GitHub Pages serves this one file for every unknown path on the
			// domain. Each site is its own single-page app, so load the app shell
			// of the site this address belongs to and let it route the path.
			var sitePaths = ${JSON.stringify(paths)};
			var path = location.pathname;
			var site = sitePaths.find(function (p) {
				return path === p || path.indexOf(p + '/') === 0;
			}) || '';
			fetch(site + '/${SHELL}', { cache: 'no-store' })
				.then(function (res) { return res.text(); })
				.then(function (html) {
					document.open();
					document.write(html);
					document.close();
				});
		</script>
	</head>
	<body></body>
</html>
`;
}

if (liveUrl) await downloadLiveData();

const allSites = JSON.parse(readFileSync(join(dataDir, 'sites.json'), 'utf8'));
const defaultSite = allSites.find((site) => site.path === '');
if (!defaultSite) throw new Error('sites.json has no site at the root path');
// The default site first: the other sites are placed inside its folder.
const sites = [defaultSite, ...allSites.filter((site) => site !== defaultSite && site.count > 0)];

// static/videos.json is also the local development sample; put it back after.
const savedVideos = existsSync(STATIC_VIDEOS) ? readFileSync(STATIC_VIDEOS) : null;
rmSync(OUT, { recursive: true, force: true });

try {
	for (const site of sites) {
		console.log(`\n=== Building ${site.id} (${site.count} videos) at ${site.path || '/'} ===`);
		copyFileSync(join(dataDir, site.file), STATIC_VIDEOS);
		execFileSync('npx', ['vite', 'build'], {
			cwd: GALLERY,
			stdio: 'inherit',
			env: {
				...process.env,
				BASE_PATH: site.path,
				VITE_SITE_ID: site.id,
				VITE_SITE_NAME: site.title
			}
		});
		const target = join(OUT, site.path);
		mkdirSync(dirname(target), { recursive: true });
		cpSync(join(GALLERY, 'build'), target, { recursive: true });
		renameSync(join(target, '404.html'), join(target, SHELL));
	}
} finally {
	if (savedVideos) writeFileSync(STATIC_VIDEOS, savedVideos);
	else rmSync(STATIC_VIDEOS, { force: true });
}

writeFileSync(join(OUT, 'sites.json'), JSON.stringify(sites, null, 2) + '\n');
writeFileSync(
	join(OUT, '404.html'),
	notFoundPage(sites.filter((site) => site.path).map((site) => site.path))
);
console.log(`\nBuilt ${sites.map((site) => site.id).join(', ')} → ${OUT}`);
