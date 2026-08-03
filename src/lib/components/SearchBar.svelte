<script lang="ts">
	import Icon from './Icon.svelte';
	import { t } from '$lib/i18n';
	import { searchUi } from '$lib/search/searchUi.svelte';

	let { lang }: { lang: string } = $props();

	// The whole bar is one button that opens the spotlight modal — the field and
	// the round accent glass are presentational, so there is no nested button and
	// no second input state to keep in sync with the modal's.
</script>

<button
	class="search-bar"
	type="button"
	onclick={() => (searchUi.open = true)}
	aria-label={t(lang, 'search.button')}
>
	<span class="placeholder">{t(lang, 'search.placeholder')}</span>
	<span class="glass" aria-hidden="true">
		<Icon name="search" size={20} />
	</span>
</button>

<style>
	/* Frosted pill, same material as the fixed menu/search toggles. */
	.search-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		max-width: 42rem;
		padding: 0.4rem 0.4rem 0.4rem 1.5rem;
		border-radius: 999px;
		background: var(--glass-2);
		backdrop-filter: blur(12px);
		border: 1px solid var(--accent2);
		box-shadow: 0 4px 12px var(--shadow-color);
		cursor: pointer;
		text-align: left;
		color: var(--background-text);
		transition:
			background-color 0.2s,
			border-color 0.2s,
			box-shadow 0.2s;
	}
	.search-bar:hover,
	.search-bar:focus-visible {
		background: var(--glass-3);
		border-color: var(--accent);
		box-shadow: 0 8px 24px var(--shadow-color);
	}

	.placeholder {
		flex: 1;
		min-width: 0;
		font-family: var(--heading-font), sans-serif;
		font-size: 1.05rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Round accent affordance on the right, sized like the nav toggles. */
	.glass {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.9rem;
		height: 2.9rem;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		transition: transform 0.2s;
	}
	.search-bar:hover .glass,
	.search-bar:focus-visible .glass {
		transform: scale(1.05);
	}

	@media (max-width: 768px) {
		.search-bar {
			padding-left: 1.1rem;
		}
		.placeholder {
			font-size: 0.95rem;
		}
		.glass {
			width: 2.5rem;
			height: 2.5rem;
		}
	}
</style>
