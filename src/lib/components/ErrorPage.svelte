<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { LANGUAGES } from '$lib/languages';
	import Icon from '$lib/components/Icon.svelte';
	import { searchUi } from '$lib/search/searchUi.svelte';

	let { status = 404, message }: { status?: number; message?: string } = $props();

	// Prerendered language-neutral (404.html is served at arbitrary URLs, so the
	// markup can't be built for one language). Default to it — the t() fallback —
	// and refine from the URL, then the browser, once hydrated.
	let lang = $state('it');
	onMount(() => {
		const seg = location.pathname.split('/').filter(Boolean)[0];
		if (seg && seg in LANGUAGES) lang = seg;
		else if (navigator.language?.toLowerCase().startsWith('en')) lang = 'en';
	});

	const key = $derived(status === 404 ? 'notFound' : 'error');
</script>

<section class="error">
	<p class="status">{status}</p>
	<h1>{t(lang, `${key}.title`)}</h1>
	<p class="body">{t(lang, `${key}.body`)}</p>
	{#if message && status !== 404}
		<p class="detail">{message}</p>
	{/if}
	<div class="actions">
		<button class="action accent" onclick={() => (searchUi.open = true)}>
			<Icon name="search" size={18} />
			{t(lang, 'notFound.search')}
		</button>
		<a class="action" href="/{lang}">
			<Icon name="home" size={18} />
			{t(lang, 'notFound.home')}
		</a>
	</div>
</section>

<style>
	.error {
		font-family: var(--heading-font), sans-serif;
		max-width: 34rem;
		margin: 14vh auto 6rem;
		padding: 0 1.5rem;
		text-align: center;
		color: var(--background-text);
	}
	.status {
		font-family: var(--heading-font), sans-serif;
		font-size: 7rem;
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.03em;
		color: var(--accent);
		margin: 0 0 0.75rem;
		font-variant-numeric: tabular-nums;
	}
	h1 {
		font-family: var(--heading-font), sans-serif;
		font-weight: 800;
		font-size: 2rem;
		margin: 0 0 0.75rem;
	}
	.body {
		font-family: var(--paragraph-font), serif;
		line-height: 1.6;
		color: var(--muted);
		margin: 0 0 1.75rem;
	}
	.detail {
		font-family: var(--code-font), monospace;
		font-size: 0.85rem;
		color: var(--muted);
		background: color-mix(in srgb, var(--secondary) 70%, transparent);
		border-radius: 0.5rem;
		padding: 0.6rem 0.9rem;
		margin: -1rem 0 1.75rem;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
	}
	.action {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.6rem 1.1rem;
		border: none;
		border-radius: 0.6rem;
		font-family: var(--heading-font), sans-serif;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		background: color-mix(in srgb, var(--secondary) 80%, transparent);
		color: var(--background-text);
		box-shadow: 0 1px 3px var(--shadow-color);
		transition:
			filter 0.2s,
			background-color 0.2s,
			box-shadow 0.2s;
	}
	.action:hover {
		background: var(--secondary);
		box-shadow: 0 6px 18px var(--shadow-color);
	}
	.action.accent {
		background: var(--accent);
		color: #fff;
	}
	.action.accent:hover {
		filter: brightness(1.15);
	}

	@media (max-width: 768px) {
		.error {
			margin-top: 10vh;
		}
		.status {
			font-size: 4.5rem;
		}
		h1 {
			font-size: 1.6rem;
		}
	}
</style>
