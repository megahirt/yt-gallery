<script lang="ts">
	import { onMount } from 'svelte';
	import { SITE_ID } from '$lib/config';

	type Site = { id: string; label: string; path: string; count: number };

	// sites.json sits at the root of the domain and lists every site with its
	// path. Only sites that have videos are offered; with nothing to switch to
	// (or no sites.json, as in local development) the switcher stays hidden.
	let sites = $state<Site[]>([]);

	onMount(async () => {
		try {
			const res = await fetch('/sites.json', { cache: 'no-store' });
			if (!res.ok) return;
			const all = (await res.json()) as Site[];
			const shown = all.filter((s) => s.count > 0 || s.id === SITE_ID);
			if (shown.length > 1) sites = shown;
		} catch {
			// No switcher without the site list.
		}
	});
</script>

{#if sites.length > 0}
	<nav class="switcher" aria-label="Switch site">
		{#each sites as site (site.id)}
			{#if site.id === SITE_ID}
				<span class="site current" aria-current="page">{site.label}</span>
			{:else}
				<!-- Each site is its own app, so this is a full page load. -->
				<a class="site" href="{site.path}/" data-sveltekit-reload>{site.label}</a>
			{/if}
		{/each}
	</nav>
{/if}

<style>
	.switcher {
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: var(--radius-sm);
		background: var(--color-surface-alt);
	}

	.site {
		flex: 1 1 0;
		min-width: 0;
		padding: 6px 4px;
		border-radius: calc(var(--radius-sm) - 2px);
		font-size: var(--text-small);
		line-height: 1.3;
		text-align: center;
		text-decoration: none;
		color: var(--color-text);
	}
	a.site:hover {
		background: var(--color-surface);
	}

	.current {
		background: var(--color-text);
		color: var(--color-bg);
		font-weight: 600;
	}
</style>
