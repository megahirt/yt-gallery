import type { Video } from '$lib/types';
import { base } from '$app/paths';

const PUBLISHED_VIDEOS_URL = import.meta.env.VITE_PUBLISHED_VIDEOS_URL as string | undefined;

function toVideoKey(videos: Video[]): string {
	return videos.map((v) => `${v.id}:${v.uploadDate}:${v.videoDate ?? ''}`).join('|');
}

function shouldTryPublishedUrl(localUrl: string): boolean {
	if (!PUBLISHED_VIDEOS_URL || typeof window === 'undefined') return false;
	try {
		const published = new URL(PUBLISHED_VIDEOS_URL, window.location.origin).href;
		const local = new URL(localUrl, window.location.origin).href;
		return published !== local;
	} catch {
		return false;
	}
}

function createVideoStore() {
	let videos = $state<Video[]>([]);
	let loading = $state(true);
	let error = $state('');
	let lazyRefreshStarted = false;

	async function loadPublishedLazy(existing: Video[]) {
		if (!PUBLISHED_VIDEOS_URL) return;
		try {
			const res = await fetch(PUBLISHED_VIDEOS_URL, { cache: 'no-store' });
			if (!res.ok) return;
			const publishedVideos = (await res.json()) as Video[];
			if (toVideoKey(publishedVideos) !== toVideoKey(existing)) {
				videos = publishedVideos;
			}
		} catch {
			// Keep existing videos on lazy refresh failures.
		}
	}

	async function load() {
		if (!loading && videos.length > 0) return;
		const localUrl = `${base}/videos.json`;
		try {
			const res = await fetch(localUrl, { cache: 'no-store' });
			if (!res.ok) throw new Error(`Failed to fetch videos: ${res.status}`);
			videos = await res.json();
			if (!lazyRefreshStarted && shouldTryPublishedUrl(localUrl)) {
				lazyRefreshStarted = true;
				void loadPublishedLazy(videos);
			}
		} catch (e) {
			if (PUBLISHED_VIDEOS_URL && !lazyRefreshStarted) {
				lazyRefreshStarted = true;
				try {
					const res = await fetch(PUBLISHED_VIDEOS_URL, { cache: 'no-store' });
					if (!res.ok) throw new Error(`Failed to fetch videos: ${res.status}`);
					videos = await res.json();
					error = '';
				} catch (publishedErr) {
					error =
						publishedErr instanceof Error
							? publishedErr.message
							: e instanceof Error
								? e.message
								: 'Failed to load videos';
				}
			} else {
				error = e instanceof Error ? e.message : 'Failed to load videos';
			}
		} finally {
			loading = false;
		}
	}

	return {
		get videos() {
			return videos;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		load
	};
}

export const videoStore = createVideoStore();
