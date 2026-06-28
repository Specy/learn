<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import Icon from '$lib/components/Icon.svelte';

	// Prerendered, language-neutral. Default to it (the t() fallback), refine to en
	// from the browser once hydrated.
	let lang = $state('it');
	onMount(() => {
		if (navigator.language?.toLowerCase().startsWith('en')) lang = 'en';
	});
</script>

<div class="offline">
	<span class="badge"><Icon name="x" size={26} /></span>
	<h1>{t(lang, 'offline.title')}</h1>
	<p>{t(lang, 'offline.body')}</p>
	<button class="retry" onclick={() => location.reload()}>{t(lang, 'offline.retry')}</button>
</div>

<style>
	.offline {
		font-family: var(--heading-font);
		max-width: 32rem;
		margin: 18vh auto 0;
		padding: 0 1.5rem;
		text-align: center;
		color: var(--background-text);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--warn) 18%, transparent);
		color: var(--warn);
		margin-bottom: 1rem;
	}
	h1 {
		font-family: var(--heading-font), sans-serif;
		font-weight: 800;
		margin: 0 0 0.5rem;
	}
	p {
		color: var(--muted);
		margin: 0 0 1.5rem;
	}
	.retry {
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		border: none;
		border-radius: 0.6rem;
		padding: 0.6rem 1.4rem;
		font-weight: 600;
		cursor: pointer;
	}
	.retry:hover {
		filter: brightness(1.08);
	}
</style>
