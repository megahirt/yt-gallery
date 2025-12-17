<script lang="ts">
	import { onMount } from 'svelte';
	import type { Video, VideosData } from '$lib/types';
	import VideoCard from '$lib/components/VideoCard.svelte';

	let videos: Video[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);

	let searchQuery = $state('');
	let selectedPlaylist = $state<string | null>(null);

	const playlists = $derived(() => {
		const playlistSet = new Set<string>();
		for (const video of videos) {
			if (video.playlist) {
				playlistSet.add(video.playlist);
			}
		}
		return Array.from(playlistSet).sort();
	});

	const filteredVideos = $derived(() => {
		let result = videos;

		if (selectedPlaylist) {
			result = result.filter((v) => v.playlist === selectedPlaylist);
		}

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(v) =>
					v.title.toLowerCase().includes(query) ||
					v.description.toLowerCase().includes(query) ||
					v.tags.some((tag) => tag.toLowerCase().includes(query)) ||
					(v.playlist && v.playlist.toLowerCase().includes(query))
			);
		}

		return result;
	});

	function clearFilters() {
		searchQuery = '';
		selectedPlaylist = null;
	}

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

	{#if !loading && !error && videos.length > 0}
		<div class="flex flex-col md:flex-row gap-4 mb-6">
			<input
				type="search"
				placeholder="Search videos..."
				bind:value={searchQuery}
				class="input w-full md:w-80"
			/>

			<select bind:value={selectedPlaylist} class="select w-full md:w-48">
				<option value={null}>All Playlists</option>
				{#each playlists() as playlist}
					<option value={playlist}>{playlist}</option>
				{/each}
			</select>

			{#if searchQuery || selectedPlaylist}
				<button type="button" class="btn preset-tonal" onclick={clearFilters}>
					Clear Filters
				</button>
			{/if}
		</div>

		<p class="text-sm text-surface-600-400 mb-4">
			Showing {filteredVideos().length} of {videos.length} videos
		</p>
	{/if}

	{#if loading}
		<div class="flex justify-center items-center py-12">
			<div class="placeholder-circle w-12 animate-pulse"></div>
		</div>
	{:else if error}
		<div class="alert preset-filled-error-500">
			<p>{error}</p>
		</div>
	{:else if filteredVideos().length === 0}
		<p class="text-center text-surface-600-400 py-12">
			{#if videos.length === 0}
				No videos found.
			{:else}
				No videos match your search.
			{/if}
		</p>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each filteredVideos() as video (video.id)}
				<VideoCard {video} />
			{/each}
		</div>
	{/if}
</div>
