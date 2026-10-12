<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { DEFAULT_LANG, INDEXABLE_LANGS, LANGUAGES, contentLang, isLang } from '$lib/languages';
	import { jsonLdScriptTag } from '$lib/jsonld';
	import { splitLangPath } from '$lib/seo';

	let {
		title,
		description,
		image,
		type = 'website',
		lang = DEFAULT_LANG,
		keywords = [],
		jsonLd
	}: {
		title?: string;
		description?: string;
		image?: string;
		type?: 'website' | 'article';
		/** URL language of the page. Aliased languages render their content language's SEO. */
		lang?: string;
		keywords?: string[];
		/** Schema.org graph for this page, serialized into a ld+json block */
		jsonLd?: unknown;
	} = $props();

	const baseUrl = 'https://learn.specy.app';

	// The language the page's text is actually written in (`en` serves Italian content for now).
	const pageLang = $derived(contentLang(lang));

	// Format Title: default to localized brand, or append brand suffix
	const siteName = 'Specy';
	const displayTitle = $derived(
		title
			? `${title} | ${siteName}`
			: pageLang === 'en'
				? 'University Notes | Specy'
				: 'Appunti universitari | Specy'
	);

	// Format Description: default to i18n home subtitle or empty
	const displayDescription = $derived(description || t(pageLang, 'home.subtitle') || '');

	// Path split from its language segment, used for canonical and hreflang targets
	const route = $derived(splitLangPath(page.url.pathname));
	const hasLangPrefix = $derived(isLang(route.segment));

	// An aliased language duplicates another language's pages, so it canonicalizes to that
	// language's URL and asks engines not to index itself. Everything else is self-canonical.
	const aliased = $derived(isLang(lang) && !!LANGUAGES[lang].aliasOf);
	const canonicalUrl = $derived(
		aliased ? `${baseUrl}/${pageLang}${route.rest}` : `${baseUrl}${page.url.pathname}`
	);

	// Format Image: handle relative path resolution
	const displayImage = $derived(() => {
		if (!image) return `${baseUrl}/images/logo.png`;
		if (image.startsWith('http')) return image;
		if (image.startsWith('/')) return `${baseUrl}${image}`;
		return `${baseUrl}/${image}`;
	});

	// Keywords tag content
	const displayKeywords = $derived(
		keywords && keywords.length > 0 ? keywords.join(', ') : undefined
	);

	// Client-side navigation swaps the page without reloading, so keep <html lang> in step.
	// The server-rendered value comes from hooks.server.ts.
	onMount(() => {
		document.documentElement.setAttribute('lang', pageLang);
	});
</script>

<svelte:head>
	<!-- Basic Meta Tags -->
	<title>{displayTitle}</title>
	<meta name="description" content={displayDescription} />
	{#if displayKeywords}
		<meta name="keywords" content={displayKeywords} />
	{/if}

	{#if aliased}
		<meta name="robots" content="noindex, follow" />
	{:else if hasLangPrefix}
		<!-- Language Alternates (hreflang): indexable languages only -->
		{#each INDEXABLE_LANGS as l (l)}
			<link rel="alternate" hreflang={l} href="{baseUrl}/{l}{route.rest}" />
		{/each}
		<link rel="alternate" hreflang="x-default" href="{baseUrl}/{DEFAULT_LANG}{route.rest}" />
	{/if}

	<!-- Canonical URL -->
	<link rel="canonical" href={canonicalUrl} />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content={type} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:title" content={displayTitle} />
	<meta property="og:description" content={displayDescription} />
	<meta property="og:image" content={displayImage()} />
	<meta property="og:site_name" content={siteName} />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content={canonicalUrl} />
	<meta name="twitter:title" content={displayTitle} />
	<meta name="twitter:description" content={displayDescription} />
	<meta name="twitter:image" content={displayImage()} />
	{#if jsonLd}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html jsonLdScriptTag(jsonLd)}
	{/if}
</svelte:head>
