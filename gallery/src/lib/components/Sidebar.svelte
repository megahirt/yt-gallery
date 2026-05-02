<script lang="ts">
	import type { PlaylistRef } from '$lib/types';
	import { SITE_NAME } from '$lib/config';
	import { PUBLIC_BUILD_VERSION } from '$env/static/public';

	const version = PUBLIC_BUILD_VERSION || 'dev';

	let {
		collections,
		selectedCollection = $bindable<string | null>(null),
		sortBy = $bindable<'videoDate' | 'uploadDate' | 'title'>('videoDate'),
		videoCounts,
		totalCount
	}: {
		collections: PlaylistRef[];
		selectedCollection: string | null;
		sortBy: 'videoDate' | 'uploadDate' | 'title';
		videoCounts: Map<string, number>;
		totalCount: number;
	} = $props();
</script>

<aside class="sidebar flex h-full w-60 shrink-0 flex-col overflow-y-auto">
	<!-- Logo row -->
	<div class="logo-row flex items-center gap-2 px-4 py-4">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 512 512" style="color: var(--color-accent);">
			<!-- Waveform / signal icon matching the app icon motif -->
			<path fill="none" stroke="currentColor" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"
				d="M32 256 L96 256 L128 160 L192 352 L224 192 L272 320 L304 128 L352 384 L384 256 L480 256" />
		</svg>
		<span class="site-name">{SITE_NAME}</span>
	</div>

	<!-- Sort By -->
	<div class="section px-4 py-3">
		<p class="section-label">Sort by</p>
		<select
			bind:value={sortBy}
			class="sort-select w-full"
		>
			<option value="videoDate">Video Date</option>
			<option value="uploadDate">Upload Date</option>
			<option value="title">Title</option>
		</select>
	</div>

	<!-- Collections -->
	<div class="section px-4 py-3">
		<p class="section-label">Collections</p>
		<nav class="space-y-0.5">
			<button
				onclick={() => (selectedCollection = null)}
				class="nav-item {selectedCollection === null ? 'active' : ''} flex w-full items-center justify-between"
			>
				<span class="flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
					</svg>
					All Videos
				</span>
				<span class="count">{totalCount}</span>
			</button>

			{#each collections as collection (collection.id)}
				<button
					onclick={() => (selectedCollection = collection.title)}
					class="nav-item {selectedCollection === collection.title ? 'active' : ''} flex w-full items-center justify-between"
				>
					<span class="truncate">{collection.title}</span>
					<span class="count ml-2 shrink-0">{videoCounts.get(collection.title) ?? 0}</span>
				</button>
			{/each}
		</nav>
	</div>

	<!-- People -->
	<div class="section border-t px-4 py-3" style="border-color: var(--color-border);">
		<p class="section-label">People</p>
		<p class="coming-soon">Coming soon</p>
	</div>

	<!-- Places -->
	<div class="section border-t px-4 py-3" style="border-color: var(--color-border);">
		<p class="section-label">Places</p>
		<p class="coming-soon">Coming soon</p>
	</div>

	<!-- Version -->
	<div class="mt-auto border-t px-4 py-3" style="border-color: var(--color-border);">
		<p class="version">{version}</p>
	</div>
</aside>

<style>
	.sidebar {
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
	}

	.logo-row {
		border-bottom: 1px solid var(--color-border);
	}

	.site-name {
		font-family: var(--font-heading);
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.section-label {
		font-family: var(--font-body);
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-text-soft);
		margin-bottom: var(--space-2);
	}

	.sort-select {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--text-small);
		padding: 6px 10px;
		outline: none;
		transition: border-color var(--transition-fast);
	}
	.sort-select:focus {
		border-color: var(--color-accent);
	}

	.nav-item {
		width: 100%;
		text-align: left;
		border-radius: var(--radius-sm);
		padding: 7px 10px;
		font-size: var(--text-small);
		color: var(--color-text);
		transition: background var(--transition-fast), color var(--transition-fast);
	}
	.nav-item:hover {
		background: var(--color-surface-alt);
	}
	.nav-item.active {
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
		color: var(--color-accent);
		font-weight: 500;
	}

	.count {
		font-size: 11px;
		color: var(--color-accent-soft);
	}

	.coming-soon {
		font-size: var(--text-small);
		color: var(--color-accent-soft);
	}

	.version {
		font-size: 11px;
		color: var(--color-accent-soft);
	}
</style>
