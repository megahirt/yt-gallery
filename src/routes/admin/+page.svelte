<script lang="ts">
	import { onMount } from 'svelte';
	import type { Video, VideosData } from '$lib/types';

	let videos: Video[] = $state([]);
	let lastUpdated: string | null = $state(null);
	let loading = $state(true);
	let error: string | null = $state(null);

	const GITHUB_REPO = 'megahirt/yt-gallery';
	const WORKFLOW_FILE = 'refresh-videos.yml';
	const githubActionsUrl = `https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`;

	function formatDate(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getStudioEditUrl(videoId: string): string {
		return `https://studio.youtube.com/video/${videoId}/edit`;
	}

	function getYouTubeUrl(videoId: string): string {
		return `https://www.youtube.com/watch?v=${videoId}`;
	}

	onMount(async () => {
		try {
			const response = await fetch('/videos.json', { cache: 'no-store' });
			if (!response.ok) {
				throw new Error(`Failed to load videos: ${response.status}`);
			}
			const data: VideosData = await response.json();
			videos = data.videos;
			lastUpdated = data.lastUpdated;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load videos';
		} finally {
			loading = false;
		}
	});
</script>

<div class="container mx-auto p-4 md:p-8">
	<header class="mb-8">
		<h1 class="h1 mb-2">Admin</h1>
		<p class="text-surface-600-400">Manage your video gallery</p>
	</header>

	<section class="card p-6 mb-8">
		<h2 class="h3 mb-4">Data Refresh</h2>
		{#if lastUpdated}
			<p class="text-sm text-surface-600-400 mb-4">
				Last updated: {formatDate(lastUpdated)}
			</p>
		{/if}
		<a
			href={githubActionsUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="btn preset-filled-primary-500"
		>
			Refresh Video Data (GitHub Actions)
		</a>
		<p class="text-sm text-surface-600-400 mt-2">
			Opens GitHub Actions where you can manually trigger a data refresh.
		</p>
	</section>

	<section>
		<h2 class="h3 mb-4">Videos ({videos.length})</h2>

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
			<div class="table-container">
				<table class="table">
					<thead>
						<tr>
							<th>Thumbnail</th>
							<th>Title</th>
							<th>Playlist</th>
							<th>Published</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each videos as video (video.id)}
							<tr>
								<td>
									<img
										src={video.thumbnail}
										alt={video.title}
										class="w-24 aspect-video object-cover rounded"
									/>
								</td>
								<td>
									<a
										href={getYouTubeUrl(video.id)}
										target="_blank"
										rel="noopener noreferrer"
										class="hover:underline"
									>
										{video.title}
									</a>
								</td>
								<td>
									{#if video.playlist}
										<span class="badge preset-filled-surface-500">{video.playlist}</span>
									{:else}
										<span class="text-surface-500">—</span>
									{/if}
								</td>
								<td class="text-sm">{formatDate(video.publishedAt)}</td>
								<td>
									<a
										href={getStudioEditUrl(video.id)}
										target="_blank"
										rel="noopener noreferrer"
										class="btn btn-sm preset-tonal"
									>
										Edit in Studio
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
