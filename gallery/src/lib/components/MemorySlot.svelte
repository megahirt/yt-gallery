<script lang="ts">
	import type { Video } from '$lib/types';
	import { formatVideoDate, videoYear } from '$lib/dates';

	let { videos }: { videos: Video[] } = $props();

	type Memory = { video: Video; eyebrow: string };

	function yearsAgoLabel(video: Video, now: Date): string {
		const years = now.getFullYear() - videoYear(video);
		if (years <= 0) return 'Earlier this year';
		return years === 1 ? '1 year ago' : `${years} years ago`;
	}

	// "On this day" matches come first; the rest follow in a shuffled order
	// that stays stable until the video list itself changes.
	const memories = $derived.by<Memory[]>(() => {
		const now = new Date();
		const onThisDay: Memory[] = [];
		const others: Memory[] = [];

		for (const video of videos) {
			const filmed = video.videoDate ? new Date(video.videoDate) : null;
			if (
				filmed &&
				filmed.getUTCMonth() === now.getMonth() &&
				filmed.getUTCDate() === now.getDate() &&
				filmed.getUTCFullYear() < now.getFullYear()
			) {
				onThisDay.push({ video, eyebrow: `On this day · ${yearsAgoLabel(video, now)}` });
			} else {
				others.push({ video, eyebrow: `Remember this? · ${yearsAgoLabel(video, now)}` });
			}
		}

		for (let i = others.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[others[i], others[j]] = [others[j], others[i]];
		}

		return [...onThisDay, ...others];
	});

	let pick = $state(0);

	const memory = $derived(memories.length > 0 ? memories[pick % memories.length] : null);
	const thumbnail = $derived(
		memory ? (memory.video.thumbnails.standard ?? memory.video.thumbnails.high) : null
	);
	const meta = $derived.by<string>(() => {
		if (!memory) return '';
		const v = memory.video;
		const date = formatVideoDate(v);
		return v.playlists.length > 0 ? `${date} · ${v.playlists[0].title}` : date;
	});
</script>

{#if memory}
	<section class="memory" aria-label="Featured memory">
		<a href="/video/{memory.video.id}" class="memory-thumb" aria-label="Watch {memory.video.title}">
			{#if thumbnail}
				<img src={thumbnail.url} alt="" class="memory-img" />
			{/if}
			<span class="play-circle">
				<svg class="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M8 5v14l11-7z" />
				</svg>
			</span>
			{#if memory.video.duration}
				<span class="duration-badge">{memory.video.duration}</span>
			{/if}
		</a>

		<div class="memory-body">
			<p class="memory-eyebrow">{memory.eyebrow}</p>
			<h1 class="memory-title">{memory.video.title}</h1>
			<p class="memory-meta">{meta}</p>
			<div class="memory-actions">
				<a href="/video/{memory.video.id}" class="memory-btn memory-btn-primary">
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M8 5v14l11-7z" />
					</svg>
					Watch
				</a>
				{#if memories.length > 1}
					<button onclick={() => (pick += 1)} class="memory-btn memory-btn-ghost">
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M16 3h5v5" /><path d="M4 20L21 3" /><path d="M21 16v5h-5" />
							<path d="M15 15l6 6" /><path d="M4 4l5 5" />
						</svg>
						Another memory
					</button>
				{/if}
			</div>
		</div>
	</section>
{/if}

<style>
	.memory {
		display: flex;
		flex-wrap: wrap;
		overflow: hidden;
		margin: var(--space-3) var(--space-3) 0;
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-soft);
	}

	.memory-thumb {
		position: relative;
		flex: 1 1 420px;
		aspect-ratio: 16 / 9;
		max-height: 300px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface-alt);
	}

	.memory-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.play-circle {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(245, 243, 239, 0.92);
		color: var(--color-text);
		box-shadow: var(--shadow-lift);
		transition: transform var(--transition-base);
	}
	.memory-thumb:hover .play-circle {
		transform: scale(1.06);
	}

	.duration-badge {
		position: absolute;
		bottom: 10px;
		right: 10px;
		background: rgba(47, 42, 38, 0.75);
		color: #f5f3ef;
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 12px;
		line-height: 1.4;
	}

	.memory-body {
		flex: 1 1 320px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 10px;
		padding: 28px var(--space-5);
	}

	.memory-eyebrow {
		font-size: var(--text-small);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-text-soft);
	}

	.memory-title {
		font-family: var(--font-heading);
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--color-text);
	}

	.memory-meta {
		font-size: 0.875rem;
		color: var(--color-text-soft);
	}

	.memory-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.memory-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: opacity var(--transition-fast), background var(--transition-fast);
	}

	.memory-btn-primary {
		padding: 0 20px;
		background: var(--color-text);
		color: var(--color-bg);
	}
	.memory-btn-primary:hover {
		opacity: 0.85;
	}

	.memory-btn-ghost {
		border: 1px solid var(--color-accent-soft);
		background: transparent;
		color: var(--color-text);
	}
	.memory-btn-ghost:hover {
		background: var(--color-surface-alt);
	}
</style>
