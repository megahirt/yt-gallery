<script lang="ts">
	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { Video } from '$lib/types';

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

	const uploadDate = $derived(
		video
			? new Date(video.uploadDate).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: ''
	);

	const videoDateFormatted = $derived(
		video?.videoDate
			? new Date(video.videoDate).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: null
	);

	const viewCount = $derived(video ? Number(video.viewCount).toLocaleString() : '');

	let playing = $state(false);
	let copied = $state(false);

	function copyLink() {
		const url = `https://www.youtube.com/watch?v=${video?.id}`;
		navigator.clipboard.writeText(url).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}
</script>

<svelte:head>
	<title>{video?.title ?? 'Video'} — Hirt Family Gallery</title>
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

			<!-- Metadata -->
			<div class="meta-card">
				<h1 class="video-title">{video.title}</h1>

				<div class="meta-row">
					<span>Uploaded {uploadDate}</span>
					{#if videoDateFormatted}
						<span>·</span>
						<span>Filmed {videoDateFormatted}</span>
					{/if}
					<span>·</span>
					<span>{viewCount} views</span>
				</div>

				{#if video.playlists.length > 0 || video.tags.length > 0}
					<div class="tags-row">
						{#each video.playlists as playlist (playlist.id)}
							<span class="tag tag-accent">{playlist.title}</span>
						{/each}
						{#each video.tags as tag (tag)}
							<span class="tag">#{tag}</span>
						{/each}
					</div>
				{/if}

				{#if video.description}
					<div class="description">
						<p class="description-label">Description</p>
						<p class="description-text">{video.description}</p>
					</div>
				{/if}
			</div>
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
		background: var(--color-surface-alt);
		color: var(--color-text-soft);
		border-radius: 999px;
		padding: 3px 12px;
		font-size: var(--text-small);
	}
	.tag-accent {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
	}

	.description {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--color-border);
	}

	.description-label {
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-text-soft);
		margin-bottom: 8px;
		letter-spacing: 0.02em;
	}

	.description-text {
		font-size: var(--text-small);
		color: var(--color-text);
		white-space: pre-wrap;
		line-height: var(--leading-relaxed);
	}
</style>
