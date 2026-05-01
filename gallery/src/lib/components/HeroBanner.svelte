<script lang="ts">
	import { SITE_NAME, SITE_SUBTITLE } from '$lib/config';
	import { base } from '$app/paths';

	let imgError = $state(false);
</script>

<div class="hero">
	{#if !imgError}
		<img
			src="{base}/hero.jpg"
			alt="Gallery hero"
			class="hero-img"
			onerror={() => (imgError = true)}
		/>
	{/if}
	<div class="hero-overlay"></div>
	<div class="hero-content">
		<h1 class="hero-title">{SITE_NAME}</h1>
		<p class="hero-subtitle">{SITE_SUBTITLE}</p>
	</div>
</div>

<style>
	.hero {
		position: relative;
		width: 100%;
		height: 240px;
		overflow: hidden;
		background: var(--color-surface);
	}

	.hero-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: brightness(0.92) saturate(0.85);
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(47, 42, 38, 0.55) 0%, rgba(47, 42, 38, 0.1) 60%);
	}

	.hero-content {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		height: 100%;
		padding: 0 var(--space-5) var(--space-5);
	}

	.hero-title {
		font-family: var(--font-heading);
		font-size: var(--text-h1);
		font-weight: 700;
		color: #F5F3EF;
		letter-spacing: 0.01em;
		text-shadow: 0 1px 4px rgba(0,0,0,0.3);
	}

	.hero-subtitle {
		margin-top: var(--space-1);
		font-family: var(--font-body);
		font-size: 1.05rem;
		color: rgba(245, 243, 239, 0.8);
	}
</style>
