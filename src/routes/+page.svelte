<script lang="ts">
	import { onMount } from 'svelte';
	import type { Video, VideosData } from '$lib/types';
	import VideoCard from '$lib/components/VideoCard.svelte';

	let videos: Video[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);

	onMount(async () => {
		try {
			const response = await fetch('/videos.json', { cache: 'no-store' });
			if (!response.ok) {
				throw new Error(`Failed to load videos: ${response.status}`);
			}
			const data: VideosData = await response.json();
			videos = data.videos;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load videos';
		} finally {
			loading = false;
		}
	});
</script>

<div class="container mx-auto p-4 md:p-8">
	<header class="mb-8">
		<h1 class="h1 mb-2">Family Video Gallery</h1>
		<p class="text-surface-600-400">Browse our family videos</p>
	</header>

	{#if loading}
		<div class="flex justify-center items-center py-12">
			<div class="placeholder-circle w-12 animate-pulse"></div>
		</div>
	{:else if error}
		<div class="alert preset-filled-error-500">
			<p>{error}</p>
		</div>
	{:else if videos.length === 0}
		<p class="text-center text-surface-600-400 py-12">No videos found.</p>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each videos as video (video.id)}
				<VideoCard {video} />
			{/each}
		</div>
	{/if}
</div>
