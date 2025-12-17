<script lang="ts">
	import type { Video } from '$lib/types';

	interface Props {
		video: Video;
	}

	let { video }: Props = $props();

	function formatDuration(isoDuration: string): string {
		const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
		if (!match) return '';
		const hours = match[1] ? parseInt(match[1]) : 0;
		const minutes = match[2] ? parseInt(match[2]) : 0;
		const seconds = match[3] ? parseInt(match[3]) : 0;
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function formatDate(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	const youtubeUrl = $derived(`https://www.youtube.com/watch?v=${video.id}`);
</script>

<a
	href={youtubeUrl}
	target="_blank"
	rel="noopener noreferrer"
	class="card block overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all"
>
	<div class="relative">
		<img src={video.thumbnail} alt={video.title} class="w-full aspect-video object-cover" />
		<span class="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
			{formatDuration(video.duration)}
		</span>
	</div>
	<div class="p-4 space-y-2">
		<h3 class="font-semibold line-clamp-2">{video.title}</h3>
		<div class="text-sm text-surface-600-400 flex items-center gap-2">
			<span>{formatDate(video.publishedAt)}</span>
			{#if video.playlist}
				<span>•</span>
				<span class="badge preset-filled-primary-500">{video.playlist}</span>
			{/if}
		</div>
	</div>
</a>
