<script lang="ts">
	import { page } from '$app/state';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import Logo from '$lib/components/Logo.svelte';

	// Derive lang from the first path segment; fall back to 'it'
	const lang = $derived(page.url.pathname.split('/').filter(Boolean)[0] ?? 'it');

	// Language switcher is hidden for now (only one language published). Flip this
	// to re-enable the IT/EN picker — the component itself is kept intact.
	const SHOW_LANGUAGE_SWITCHER = false;
</script>

<header class="nav">
	<Logo {lang} />
	<div class="nav-controls">
		{#if SHOW_LANGUAGE_SWITCHER}
			<LanguageSwitcher />
		{/if}
		<ThemeToggle />
	</div>
</header>

<style>
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 1.5rem 1.5rem 8.5rem;
	}

	@media (max-width: 768px) {
		.nav {
			padding: 1rem 1rem 1rem 7.5rem;
		}
	}

	.nav-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
</style>
