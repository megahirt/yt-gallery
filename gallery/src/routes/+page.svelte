<script lang="ts">
	import { getContext } from 'svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { Video, PlaylistRef } from '$lib/types';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import HeroBanner from '$lib/components/HeroBanner.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import VideoCard from '$lib/components/VideoCard.svelte';

	type VideoStore = {
		videos: Video[];
		loading: boolean;
		error: string;
		load: () => Promise<void>;
	};

	const store = getContext<VideoStore>('videoStore');

	const initParams = page.url.searchParams;

	let searchQuery = $state(initParams.get('q') ?? '');
	let selectedCollection = $state<string | null>(initParams.get('collection'));
	let sortBy = $state<'videoDate' | 'uploadDate' | 'title'>(
		(initParams.get('sort') as 'videoDate' | 'uploadDate' | 'title') ?? 'videoDate'
	);
	let density = $state<'large' | 'medium' | 'list'>(
		(initParams.get('density') as 'large' | 'medium' | 'list') ?? 'medium'
	);
	let sidebarOpen = $state(false);
	let canSyncUrl = $state(false);

	onMount(() => {
		canSyncUrl = true;
	});

	function syncUrl() {
		if (typeof window === 'undefined') return;
		const u = new URL(page.url);
		searchQuery ? u.searchParams.set('q', searchQuery) : u.searchParams.delete('q');
		selectedCollection
			? u.searchParams.set('collection', selectedCollection)
			: u.searchParams.delete('collection');
		sortBy !== 'videoDate'
			? u.searchParams.set('sort', sortBy)
			: u.searchParams.delete('sort');
		density !== 'medium'
			? u.searchParams.set('density', density)
			: u.searchParams.delete('density');
		const next = `${u.pathname}${u.search}${u.hash}`;
		const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (next !== current) {
			window.history.replaceState(window.history.state, '', next);
		}
	}

	$effect(() => {
		if (!canSyncUrl) return;
		searchQuery;
		selectedCollection;
		sortBy;
		density;
		syncUrl();
	});

	const collections = $derived.by<PlaylistRef[]>(() => {
		const map = new Map<string, PlaylistRef>();
		for (const video of store.videos) {
			for (const p of video.playlists) {
				if (!map.has(p.id)) map.set(p.id, p);
			}
		}
		return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
	});

	const videoCounts = $derived.by<Map<string, number>>(() => {
		const counts = new Map<string, number>();
		for (const video of store.videos) {
			for (const p of video.playlists) {
				counts.set(p.title, (counts.get(p.title) ?? 0) + 1);
			}
		}
		return counts;
	});

	const filteredVideos = $derived.by<Video[]>(() => {
		let result = store.videos;

		if (selectedCollection) {
			result = result.filter((v) => v.playlists.some((p) => p.title === selectedCollection));
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(v) =>
					v.title.toLowerCase().includes(q) ||
					v.description.toLowerCase().includes(q) ||
					v.tags.some((t) => t.toLowerCase().includes(q)) ||
					v.playlists.some((p) => p.title.toLowerCase().includes(q))
			);
		}

		if (sortBy === 'title') {
			result = [...result].sort((a, b) => a.title.localeCompare(b.title));
		} else if (sortBy === 'uploadDate') {
			result = [...result].sort(
				(a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
			);
		} else {
			result = [...result].sort((a, b) => {
				const da = a.videoDate ?? a.uploadDate;
				const db = b.videoDate ?? b.uploadDate;
				return new Date(db).getTime() - new Date(da).getTime();
			});
		}

		return result;
	});

	type YearGroup = { year: number; videos: Video[] };

	const videoGroups = $derived.by<YearGroup[] | null>(() => {
		if (sortBy === 'title') return null;

		const map = new Map<number, Video[]>();
		for (const video of filteredVideos) {
			const dateStr =
				sortBy === 'uploadDate' ? video.uploadDate : (video.videoDate ?? video.uploadDate);
			const year = new Date(dateStr).getFullYear();
			if (!map.has(year)) map.set(year, []);
			map.get(year)!.push(video);
		}
		return Array.from(map.entries())
			.sort(([a], [b]) => b - a)
			.map(([year, videos]) => ({ year, videos }));
	});

	const gridClass = $derived.by<string>(() => {
		if (density === 'large') return 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';
		if (density === 'list') return 'grid grid-cols-1 gap-3';
		return 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
	});

	const showHero = $derived(!selectedCollection && !searchQuery.trim());
	const pageTitle = $derived(selectedCollection ?? 'All Videos');
</script>

<svelte:head>
	<title>MegaHirt Gallery</title>
</svelte:head>

<div class="flex h-screen" style="background: var(--color-bg);">
	<!-- Mobile sidebar backdrop -->
	{#if sidebarOpen}
		<div
			class="fixed inset-0 z-20 lg:hidden"
			style="background: rgba(47,42,38,0.4);"
			role="presentation"
			onclick={() => (sidebarOpen = false)}
		></div>
	{/if}

	<!-- Sidebar -->
	<div
		class="fixed inset-y-0 left-0 z-30 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 {sidebarOpen
			? 'translate-x-0'
			: '-translate-x-full'}"
	>
		<Sidebar
			{collections}
			bind:selectedCollection
			bind:sortBy
			{videoCounts}
			totalCount={store.videos.length}
		/>
	</div>

	<!-- Main content -->
	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<!-- Top bar -->
		<div class="topbar flex items-center gap-3 px-4 py-3">
			<!-- Hamburger (mobile) -->
			<button
				class="rounded-lg p-1.5 lg:hidden"
				style="color: var(--color-text-soft);"
				onclick={() => (sidebarOpen = !sidebarOpen)}
				aria-label="Toggle sidebar"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>

			<span class="shrink-0 text-base font-semibold" style="font-family: var(--font-heading); color: var(--color-text);">{pageTitle}</span>

			<!-- Search -->
			<div class="min-w-0 flex-1">
				<SearchBar bind:value={searchQuery} />
			</div>

			<!-- Density toggle -->
			<div class="flex shrink-0 items-center gap-1 rounded-lg p-1" style="border: 1px solid var(--color-border); background: var(--color-bg);">
				{#each (['large', 'medium', 'list'] as const) as d}
					<button
						onclick={() => (density = d)}
						class="rounded p-1.5 transition-colors"
						style={density === d
							? 'background: var(--color-surface); color: var(--color-accent); box-shadow: var(--shadow-soft);'
							: 'color: var(--color-accent-soft);'}
						title={d === 'large' ? 'Large grid' : d === 'medium' ? 'Medium grid' : 'List view'}
					>
						{#if d === 'large'}
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
								<rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
								<rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
							</svg>
						{:else if d === 'medium'}
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
								<rect x="1" y="1" width="4" height="4" rx="0.5" /><rect x="6" y="1" width="4" height="4" rx="0.5" /><rect x="11" y="1" width="4" height="4" rx="0.5" />
								<rect x="1" y="6" width="4" height="4" rx="0.5" /><rect x="6" y="6" width="4" height="4" rx="0.5" /><rect x="11" y="6" width="4" height="4" rx="0.5" />
								<rect x="1" y="11" width="4" height="4" rx="0.5" /><rect x="6" y="11" width="4" height="4" rx="0.5" /><rect x="11" y="11" width="4" height="4" rx="0.5" />
							</svg>
						{:else}
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
								<rect x="1" y="1" width="14" height="3" rx="1" /><rect x="1" y="6" width="14" height="3" rx="1" /><rect x="1" y="11" width="14" height="3" rx="1" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- Scrollable content -->
		<div class="main-content flex-1 overflow-y-auto">
			{#if showHero}
				<HeroBanner />
			{/if}

			<div class="p-4">
				{#if store.loading}
					<p class="mt-8 text-center" style="color: var(--color-text-soft);">Loading videos...</p>
				{:else if store.error}
					<p class="mt-8 text-center" style="color: var(--color-accent);">{store.error}</p>
				{:else if filteredVideos.length === 0}
					<p class="mt-8 text-center" style="color: var(--color-text-soft);">No videos found.</p>
				{:else if sortBy === 'title'}
					<div class={gridClass}>
						{#each filteredVideos as video (video.id)}
							<VideoCard {video} {density} onTagClick={(tag) => (searchQuery = tag)} />
						{/each}
					</div>
				{:else}
					{#each videoGroups ?? [] as group (group.year)}
						<div class="mb-8">
							<div class="mb-3 flex items-center gap-3">
								<h2 class="text-sm font-semibold" style="font-family: var(--font-body); color: var(--color-text-soft); letter-spacing: 0.05em;">{group.year}</h2>
								<div class="h-px flex-1" style="background: var(--color-border);"></div>
							</div>
							<div class={gridClass}>
								{#each group.videos as video (video.id)}
									<VideoCard {video} {density} onTagClick={(tag) => (searchQuery = tag)} />
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>
