<script lang="ts">
	import type { PageProps } from './$types';
	import CourseCard from '$lib/components/CourseCard.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { t } from '$lib/i18n';
	let { data }: PageProps = $props();
</script>

<SEO lang={data.lang} />

<section class="article">
	<header
	    class="hero"
		style="display: flex; flex-direction: column; gap: 2rem; align-items: center;"
	>
		<h1 class="main-header">{t(data.lang, 'home.prompt')}</h1>
		<div class="search-row">
			<SearchBar lang={data.lang} />
		</div>
	</header>

	<h2 class="section" style="margin-top: 6rem;">{t(data.lang, 'home.degrees')}</h2>
	<div class="grid">
		{#each data.cdls ?? [] as c}
			<CourseCard
				title={c.title}
				description={c.description}
				image={c.image}
				tags={c.tags}
				lang={data.lang}
				url={c.url}
			/>
		{/each}
	</div>
</section>

<style>
	.grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		margin-top: 1rem;
	}

	.search-row{
	    display: flex;
	    gap: 1rem;
		width: 100%;
		justify-content: center;
	}
</style>
