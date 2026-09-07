<script lang="ts">
	import type { PageProps } from './$types';
	import SEO from '$lib/components/SEO.svelte';
	import { siteLd } from '$lib/jsonld';
	import { LANGUAGES } from '$lib/languages';
	import FaArrowRight from '~icons/fa-solid/arrow-right'


	let { data }: PageProps = $props();

	// The vault is written in Italian; `en` currently serves the same notes with a
	// translated interface, so both entries lead to the same material.
	const entries = [
		{
			lang: 'it' as const,
			href: '/it',
			label: 'Italiano',
			blurb:
				'Appunti universitari di informatica: analisi, fisica, basi di dati, reti, IA e altro.',
			cta: 'Sfoglia i corsi'
		},
		{
			lang: 'en' as const,
			href: '/en',
			label: 'English',
			blurb:
				'Computer science university notes: analysis, physics, databases, networks, AI and more.',
			cta: 'Browse the courses'
		}
	];
</script>

<SEO
	title="Appunti universitari di informatica"
	description="Appunti universitari di informatica in italiano: analisi, fisica, basi di dati, reti, intelligenza artificiale e altro. Liberi da consultare, scritti e mantenuti da Specy."
	jsonLd={siteLd()}
/>

<section class="article">
	<header class="hero">
		<h1 class="main-header">Appunti universitari</h1>
		<p class="lede">
			Una raccolta aperta di appunti di informatica presi durante il corso di laurea, dagli esami di
			analisi e fisica fino a basi di dati, reti e intelligenza artificiale. Tutto consultabile
			liberamente, senza registrazione.
		</p>
	</header>

	<h2 class="section">Scegli la lingua · Choose a language</h2>
	<div class="langs">
		{#each entries as entry (entry.lang)}
			<a class="lang-card" href={entry.href} hreflang={entry.lang}>
				<span class="lang-label">{entry.label}</span>
				<span class="lang-blurb">{entry.blurb}</span>
				<span class="lang-count">
					{data.perLang[entry.lang] ?? 0} pagine · {LANGUAGES[entry.lang].label}
				</span>
				<span class="lang-cta">
					{entry.cta}
					<FaArrowRight />
				</span>
			</a>
		{/each}
	</div>
</section>

<style>
	.hero {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
		text-align: center;
	}
	.lede {
		max-width: 42rem;
		margin: 0;
		color: var(--text-muted, inherit);
		line-height: 1.65;
	}
	.langs {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		margin-top: 1rem;
	}
	.lang-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.25rem;
		border-radius: var(--radius-lg, 0.75rem);
		background: var(--surface-1, rgb(255 255 255 / 4%));
		border: 1px solid var(--border, rgb(128 128 128 / 25%));
		text-decoration: none;
		color: inherit;
		transition: all 0.2s;
	}
	.lang-card:hover,
	.lang-card:focus-visible {
		background: color-mix(in srgb, var(--secondary) 95%, transparent);
		box-shadow: 0 6px 20px var(--shadow-color);
	}
	.lang-label {
		font-size: 1.25rem;
		font-weight: 700;
	}
	.lang-blurb {
		line-height: 1.55;
	}
	.lang-count {
		font-size: 0.85rem;
		opacity: 0.7;
		font-variant-numeric: tabular-nums;
	}
	.lang-cta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		font-weight: 600;
		margin-top: auto;
	}
</style>
