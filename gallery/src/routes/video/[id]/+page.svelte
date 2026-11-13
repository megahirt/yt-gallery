<script lang="ts">
	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { Video } from '$lib/types';
	import { EXCLUDED_TAGS } from '$lib/config';
	import { formatFilmedDate, formatUploadDate, videoTime, videoYear } from '$lib/dates';
	import VideoCard from '$lib/components/VideoCard.svelte';

	type VideoStore = {
		videos: Video[];
		loading: boolean;
		error: string;
		load: () => Promise<void>;
	};

	const store = getContext<VideoStore>('videoStore');

	const videoId = $derived(page.params.id);
	const video = $derived(store.videos.find((v) => v.id === videoId) ?? null);
	const thumbnail = $derived(video ? (video.thumbnails.standard ?? video.thumbnails.high) : null);

	const uploadDate = $derived(video ? formatUploadDate(video.uploadDate, 'long') : '');

	const videoDateFormatted = $derived(
		video?.videoDate ? formatFilmedDate(video.videoDate, 'long') : null
	);

	const sortTime = videoTime;
	const isExcluded = (v: Video) => v.tags.some((t) => EXCLUDED_TAGS.includes(t));

	type Context = { label: string; href: string | null; videos: Video[] };

	// The set this video is browsed within: the first of its collections that
	// has other videos, otherwise the other videos from the same year.
	const context = $derived.by<Context | null>(() => {
		const current = video;
		if (!current) return null;
		const pool = isExcluded(current) ? store.videos : store.videos.filter((v) => !isExcluded(v));
		const oldestFirst = (vs: Video[]) => [...vs].sort((a, b) => sortTime(a) - sortTime(b));

		for (const playlist of current.playlists) {
			const members = pool.filter((v) => v.playlists.some((p) => p.id === playlist.id));
			if (members.length > 1) {
				return {
					label: playlist.title,
					href: `/?collection=${encodeURIComponent(playlist.title)}`,
					videos: oldestFirst(members)
				};
			}
		}

		const year = videoYear(current);
		const sameYear = pool.filter((v) => videoYear(v) === year);
		if (sameYear.length > 1) {
			return { label: String(year), href: null, videos: oldestFirst(sameYear) };
		}
		return null;
	});

	const position = $derived(context ? context.videos.findIndex((v) => v.id === videoId) : -1);
	const prevVideo = $derived(context && position > 0 ? context.videos[position - 1] : null);
	const nextVideo = $derived(
		context && position >= 0 && position < context.videos.length - 1
			? context.videos[position + 1]
			: null
	);
	const moreVideos = $derived.by<Video[]>(() => {
		if (!context) return [];
		return context.videos
			.filter((v) => v.id !== videoId)
			.reverse()
			.slice(0, 4);
	});

	let playing = $state(false);
	let copied = $state(false);

	// Moving to another video reuses this page, so stop the previous player.
	$effect(() => {
		videoId;
		playing = false;
	});

	function copyLink() {
		const url = `https://www.youtube.com/watch?v=${video?.id}`;
		navigator.clipboard.writeText(url).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}
</script>

<svelte:head>
	<title>{video?.title ?? 'Video'} — MegaHirt Gallery</title>
</svelte:head>

<div class="page-shell">
	<!-- Top bar -->
	<div class="topbar">
		<div class="topbar-inner">
			<a href="/" class="back-link">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
				Back to Gallery
			</a>

			{#if video}
				<div class="actions">
					<button onclick={copyLink} class="action-btn" title="Copy link">
						{#if copied}
							<svg class="h-4 w-4 icon-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							Copied!
						{:else}
							<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
							</svg>
							Copy link
						{/if}
					</button>
					<a
						href="https://www.youtube.com/watch?v={video.id}"
						target="_blank"
						rel="noopener noreferrer"
						class="action-btn"
					>
						<svg class="h-4 w-4 icon-yt" viewBox="0 0 24 24" fill="currentColor">
							<path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
						</svg>
						Watch on YouTube
					</a>
				</div>
			{/if}
		</div>
	</div>

	<!-- Content -->
	<div class="content">
		{#if store.loading}
			<p class="state-msg">Loading...</p>
		{:else if !video}
			<p class="state-msg">Video not found.</p>
		{:else}
			<!-- Player -->
			<div class="player-wrap">
				{#if playing}
					<iframe
						src="https://www.youtube-nocookie.com/embed/{video.id}?autoplay=1"
						title={video.title}
						class="aspect-video w-full"
						allow="autoplay; fullscreen; picture-in-picture"
						allowfullscreen
					></iframe>
				{:else}
					<button
						onclick={() => (playing = true)}
						class="play-button group relative block w-full"
						aria-label="Play {video.title}"
					>
						{#if thumbnail}
							<img src={thumbnail.url} alt={video.title} class="aspect-video w-full object-cover" />
						{:else}
							<div class="aspect-video w-full" style="background: var(--color-surface-alt);"></div>
						{/if}
						<div class="play-overlay">
							<div class="play-circle">
								<svg class="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24" style="color: var(--color-text);">
									<path d="M8 5v14l11-7z" />
								</svg>
							</div>
						</div>
					</button>
				{/if}
			</div>

			{#if prevVideo || nextVideo}
				<nav class="prev-next" aria-label="Previous and next in {context?.label}">
					{#if prevVideo}
						<a href="/video/{prevVideo.id}" class="step-link">
							<svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
							<span class="step-text">
								<span class="step-label">Previous in {context?.label}</span>
								<span class="step-title">{prevVideo.title}</span>
							</span>
						</a>
					{/if}
					{#if nextVideo}
						<a href="/video/{nextVideo.id}" class="step-link step-next">
							<span class="step-text">
								<span class="step-label">Next in {context?.label}</span>
								<span class="step-title">{nextVideo.title}</span>
							</span>
							<svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						</a>
					{/if}
				</nav>
			{/if}

			<!-- Metadata -->
			<div class="meta-card">
				<h1 class="video-title">{video.title}</h1>

				<div class="meta-row">
					{#if videoDateFormatted}
						<span>Filmed {videoDateFormatted}</span>
					{:else}
						<span>Uploaded {uploadDate}</span>
					{/if}
					{#if video.duration}
						<span>·</span>
						<span>{video.duration}</span>
					{/if}
				</div>

				{#if video.playlists.length > 0 || video.tags.length > 0}
					<div class="tags-row">
						{#each video.playlists as playlist (playlist.id)}
							<a href="/?collection={encodeURIComponent(playlist.title)}" class="tag tag-accent">{playlist.title}</a>
						{/each}
						{#each video.tags as tag (tag)}
							<a href="/?q={encodeURIComponent(tag)}" class="tag">#{tag}</a>
						{/each}
					</div>
				{/if}

				{#if video.description}
					<div class="description">
						<p class="description-text">{video.description}</p>
					</div>
				{/if}
			</div>

			{#if moreVideos.length > 0 && context}
				<section class="more">
					<div class="more-head">
						<h2 class="more-title">More from {context.label}</h2>
						{#if context.href}
							<a href={context.href} class="more-all">See all {context.videos.length}</a>
						{/if}
					</div>
					<div class="more-grid">
						{#each moreVideos as other (other.id)}
							<VideoCard video={other} />
						{/each}
					</div>
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	.page-shell {
		min-height: 100vh;
		background: var(--color-bg);
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		padding: 12px 16px;
	}

	.topbar-inner {
		max-width: 56rem;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-small);
		font-weight: 500;
		color: var(--color-text-soft);
		text-decoration: none;
		transition: color var(--transition-fast);
	}
	.back-link:hover { color: var(--color-accent); }

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 6px 12px;
		font-size: var(--text-small);
		color: var(--color-text-soft);
		background: transparent;
		cursor: pointer;
		text-decoration: none;
		transition: background var(--transition-fast), color var(--transition-fast);
	}
	.action-btn:hover {
		background: var(--color-surface-alt);
		color: var(--color-text);
	}

	.icon-success { color: #6B8F6B; }
	.icon-yt { color: #c0392b; }

	.content {
		max-width: 56rem;
		margin: 0 auto;
		padding: 24px 16px;
	}

	.state-msg {
		text-align: center;
		margin-top: 32px;
		color: var(--color-text-soft);
	}

	.player-wrap {
		border-radius: var(--radius);
		overflow: hidden;
		background: #1a1614;
		box-shadow: var(--shadow-lift);
	}

	.play-button {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.play-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(47, 42, 38, 0.2);
		transition: background var(--transition-base);
	}
	.play-button:hover .play-overlay {
		background: rgba(47, 42, 38, 0.32);
	}

	.play-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(245, 243, 239, 0.92);
		box-shadow: var(--shadow-lift);
		transition: transform var(--transition-base);
	}
	.play-button:hover .play-circle {
		transform: scale(1.06);
	}

	.meta-card {
		margin-top: 16px;
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-soft);
		padding: 24px;
	}

	.video-title {
		font-family: var(--font-heading);
		font-size: var(--text-h2);
		font-weight: 700;
		color: var(--color-text);
		line-height: 1.25;
		letter-spacing: 0.01em;
	}

	.meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
		font-size: var(--text-small);
		color: var(--color-text-soft);
	}

	.tags-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
	}

	.tag {
		display: inline-block;
		text-decoration: none;
		background: var(--color-surface-alt);
		color: var(--color-text);
		border-radius: 999px;
		padding: 3px 12px;
		font-size: var(--text-small);
	}
	.tag-accent {
		background: var(--color-text);
		color: var(--color-bg);
	}

	.prev-next {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
		margin-top: 16px;
	}

	.step-link {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		padding: 10px 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		color: var(--color-text-soft);
		text-decoration: none;
		transition: background var(--transition-fast);
	}
	.step-link:hover {
		background: var(--color-surface);
	}
	.step-next {
		justify-content: flex-end;
		text-align: right;
	}

	.step-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.step-label {
		font-size: 12px;
		color: var(--color-text-soft);
	}

	.step-title {
		font-family: var(--font-heading);
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.35;
		color: var(--color-text);
	}

	.more {
		margin-top: 32px;
	}

	.more-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 12px;
	}

	.more-title {
		font-family: var(--font-heading);
		font-size: var(--text-h3);
		font-weight: 600;
		color: var(--color-text);
	}

	.more-all {
		font-size: var(--text-small);
		font-weight: 500;
		color: var(--color-text);
		text-decoration: underline;
	}

	.more-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 20px 12px;
	}

	.description {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--color-border);
	}


	.description-text {
		font-size: var(--text-small);
		color: var(--color-text);
		white-space: pre-wrap;
		line-height: var(--leading-relaxed);
	}
</style>
