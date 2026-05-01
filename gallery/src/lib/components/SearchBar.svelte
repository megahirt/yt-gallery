<script lang="ts">
	let { value = $bindable('') }: { value: string } = $props();
</script>

<div class="search-wrap">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="search-icon"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
	</svg>
	<input
		type="search"
		placeholder="Search videos..."
		class="search-input"
		bind:value
	/>
</div>

<style>
	.search-wrap {
		position: relative;
	}

	.search-icon {
		pointer-events: none;
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		width: 16px;
		height: 16px;
		color: var(--color-accent-soft);
	}

	.search-input {
		width: 100%;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 7px 12px 7px 34px;
		font-family: var(--font-body);
		font-size: var(--text-small);
		color: var(--color-text);
		outline: none;
		transition: border-color var(--transition-fast);
	}
	.search-input::placeholder {
		color: var(--color-accent-soft);
	}
	.search-input:focus {
		border-color: var(--color-accent);
	}
</style>
