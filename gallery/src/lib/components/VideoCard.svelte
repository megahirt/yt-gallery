<script lang="ts">
	import type { Video } from '$lib/types';
	import { goto } from '$app/navigation';

	let {
		video,
		density = 'medium'
	}: {
		video: Video;
		density?: 'large' | 'medium' | 'list';
	} = $props();

	const thumbnail = $derived(video.thumbnails.standard ?? video.thumbnails.high);

	const date = $derived(
		new Date(video.videoDate ?? video.uploadDate).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);

	function navigate() {
		goto(`/video/${video.id}`);
	}
</script>

{#if density === 'list'}
	<div
		role="button"
		tabindex="0"
		class="video-card list-card flex cursor-pointer gap-4 p-3"
		onclick={navigate}
		onkeydown={(e) => e.key === 'Enter' && navigate()}
	>
		{#if thumbnail}
			<div class="relative shrink-0">
				<img
					src={thumbnail.url}
					alt={video.title}
					class="h-24 w-40 rounded-lg object-cover"
					loading="lazy"
				/>
				{#if video.duration}
					<span class="duration-badge">{video.duration}</span>
				{/if}
			</div>
		{/if}
		<div class="min-w-0 flex-1 py-1">
			<h3 class="card-title line-clamp-2">{video.title}</h3>
			<p class="meta-text mt-1">{date}</p>
		</div>
	</div>
{:else}
	<div
		role="button"
		tabindex="0"
		class="video-card grid-card cursor-pointer"
		onclick={navigate}
		onkeydown={(e) => e.key === 'Enter' && navigate()}
	>
		<div class="thumb relative overflow-hidden">
			{#if thumbnail}
				<img
					src={thumbnail.url}
					alt={video.title}
					class="aspect-video w-full object-cover"
					loading="lazy"
				/>
			{:else}
				<div class="aspect-video w-full"></div>
			{/if}
			{#if video.duration}
				<span class="duration-badge">{video.duration}</span>
			{/if}
		</div>
		<div class="px-0.5 pt-2">
			<h3 class="card-title line-clamp-2">{video.title}</h3>
			<p class="meta-text text-xs">{date}</p>
		</div>
	</div>
{/if}

<style>
	.list-card {
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-soft);
		transition: transform var(--transition-base), box-shadow var(--transition-base);
	}
	.list-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-lift);
	}

	.thumb {
		background: var(--color-surface-alt);
		border-radius: var(--radius);
		box-shadow: var(--shadow-soft);
		transition: transform var(--transition-base), box-shadow var(--transition-base);
	}
	.grid-card:hover .thumb {
		transform: translateY(-2px);
		box-shadow: var(--shadow-lift);
	}

	.card-title {
		font-family: var(--font-heading);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		line-height: 1.35;
	}

	.meta-text {
		font-size: var(--text-small);
		color: var(--color-text-soft);
	}

	.duration-badge {
		position: absolute;
		bottom: 6px;
		right: 6px;
		background: rgba(47, 42, 38, 0.75);
		color: #F5F3EF;
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 11px;
	}
</style>
