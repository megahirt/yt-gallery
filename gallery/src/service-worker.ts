/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `gallery-${version}`;

// Static assets and build output to precache
const ASSETS = [...build, ...files];

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

	// Don't cache videos.json — always fetch fresh
	if (url.pathname === '/videos.json') return;

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
