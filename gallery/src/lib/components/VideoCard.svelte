<script lang="ts">
	import type { Video } from '$lib/types';
	import { goto } from '$app/navigation';

	let {
		video,
		density = 'medium',
		onTagClick
	}: {
		video: Video;
		density?: 'large' | 'medium' | 'list';
		onTagClick?: (tag: string) => void;
	} = $props();

	const thumbnail = $derived(video.thumbnails.standard ?? video.thumbnails.high);

	const date = $derived(
		new Date(video.videoDate ?? video.uploadDate).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);

	const viewCount = $derived(Number(video.viewCount).toLocaleString());
	const visibleTags = $derived(video.tags.slice(0, 3));
	const extraTagCount = $derived(Math.max(0, video.tags.length - 3));

	function navigate() {
		goto(`/video/${video.id}`);
	}

	function handleTagClick(e: MouseEvent, tag: string) {
		e.stopPropagation();
		onTagClick?.(tag);
	}
</script>

{#if density === 'list'}
	<div
		role="button"
		tabindex="0"
		class="video-card flex cursor-pointer gap-4 p-3"
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
			<div class="mt-1 flex items-center gap-3 meta-text">
				<span>{date}</span>
				<span>{viewCount} views</span>
			</div>
			{#if video.tags.length > 0}
				<div class="mt-2 flex flex-wrap gap-1">
					{#each visibleTags as tag (tag)}
						<button onclick={(e) => handleTagClick(e, tag)} class="tag">#{tag}</button>
					{/each}
					{#if extraTagCount > 0}
						<span class="meta-text">+{extraTagCount}</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div
		role="button"
		tabindex="0"
		class="video-card cursor-pointer overflow-hidden"
		onclick={navigate}
		onkeydown={(e) => e.key === 'Enter' && navigate()}
	>
		{#if thumbnail}
			<div class="relative">
				<img
					src={thumbnail.url}
					alt={video.title}
					class="aspect-video w-full object-cover"
					loading="lazy"
				/>
				{#if video.duration}
					<span class="duration-badge">{video.duration}</span>
				{/if}
			</div>
		{/if}
		<div class="space-y-1.5 p-3">
			<h3 class="card-title line-clamp-2 text-sm">{video.title}</h3>
			<div class="meta-text flex items-center gap-3 text-xs">
				<span>{date}</span>
				<span>{viewCount} views</span>
			</div>
			{#if video.tags.length > 0}
				<div class="flex flex-wrap gap-1">
					{#each visibleTags as tag (tag)}
						<button onclick={(e) => handleTagClick(e, tag)} class="tag">#{tag}</button>
					{/each}
					{#if extraTagCount > 0}
						<span class="meta-text text-xs">+{extraTagCount}</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.video-card {
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-soft);
		transition: transform var(--transition-base), box-shadow var(--transition-base);
	}
	.video-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-lift);
	}

	.card-title {
		font-family: var(--font-heading);
		font-size: 0.9rem;
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

	.tag {
		display: inline-block;
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
		color: var(--color-accent);
		border-radius: 999px;
		padding: 2px 8px;
		font-size: 11px;
		cursor: pointer;
		transition: background var(--transition-fast);
	}
	.tag:hover {
		background: color-mix(in srgb, var(--color-accent) 22%, transparent);
	}
</style>
