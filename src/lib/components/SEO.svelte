<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { LANGUAGES } from '$lib/languages';

	let {
		title,
		description,
		image,
		type = 'website',
		lang = 'it',
		keywords = []
	}: {
		title?: string;
		description?: string;
		image?: string;
		type?: 'website' | 'article';
		lang?: string;
		keywords?: string[];
	} = $props();

	const baseUrl = 'https://learn.specy.app';

	// Format Title: default to localized brand, or append brand suffix
	const siteName = 'Specy';
	const displayTitle = $derived(
		title
			? `${title} | ${siteName}`
			: lang === 'en'
				? 'University Notes | Specy'
				: 'Appunti universitari | Specy'
	);

	// Format Description: default to i18n home subtitle or empty
	const displayDescription = $derived(description || t(lang, 'home.subtitle') || '');

	// Format canonical URL using the current route path
	const canonicalUrl = $derived(`${baseUrl}${page.url.pathname}`);

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

	// Get current path suffix without lang prefix for hreflang tags
	const pathWithoutLang = $derived(page.url.pathname.replace(/^\/(it|en)\b/, ''));

	// Client side lang sync
	import { onMount } from 'svelte';
	onMount(() => {
		if (lang) {
			document.documentElement.setAttribute('lang', lang);
		}
	});
</script>

<svelte:head>
	<!-- Basic Meta Tags -->
	<title>{displayTitle}</title>
	<meta name="description" content={displayDescription} />
	{#if displayKeywords}
		<meta name="keywords" content={displayKeywords} />
	{/if}

	<!-- Language Alternates (hreflang) -->
	{#each Object.keys(LANGUAGES) as l}
		<link rel="alternate" hreflang={l} href="{baseUrl}/{l}{pathWithoutLang}" />
	{/each}
	<link rel="alternate" hreflang="x-default" href="{baseUrl}/it{pathWithoutLang}" />

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
</svelte:head>
