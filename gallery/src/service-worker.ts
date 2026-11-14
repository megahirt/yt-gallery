/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `gallery-${version}`;

// Data files change with every deploy and must always come from the network.
// Paths carry the site's base path (e.g. /work/videos.json), so match the name.
const isData = (path: string) => path.endsWith('/videos.json') || path.endsWith('/sites.json');

// Static assets and build output to precache
const ASSETS = [...build, ...files].filter((path) => !isData(path));

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	if (isData(url.pathname)) return;

	// For cached assets: cache-first
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.match(event.request).then((cached) => cached ?? fetch(event.request))
		);
		return;
	}

	// For navigation requests: network-first, fall back to cache
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request).catch(() => caches.match(event.request).then((r) => r ?? Response.error()))
		);
	}
});
