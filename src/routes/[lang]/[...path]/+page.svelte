<script lang="ts">
	import type { PageProps } from './$types';
	import type { NoteNode } from '$lib/content/types';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import NoteNav from '$lib/components/NoteNav.svelte';
	import Toc from '$lib/components/Toc.svelte';
	import { t } from '$lib/i18n';
	import RenderedMarkdown from '$lib/components/RenderedMarkdown.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import Authors from '$lib/components/Authors.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: PageProps = $props();

	// Icon per content type, shown to the left of each item in the unified list.
	function iconFor(type: string | undefined) {
		return type === 'resource'
			? 'paperclip'
			: type === 'exercise'
				? 'edit'
				: type === 'exam'
					? 'clipboard'
					: type === 'summary'
						? 'list'
						: 'book'; // lecture / default
	}

	const keywords = $derived(
		(() => {
			if (data.kind !== 'note') return [];
			const node = data.node as NoteNode;
			const fm = node.frontmatter as { topics?: unknown; tags?: unknown; keywords?: unknown };
			const raw = fm.topics || fm.tags || fm.keywords;
			if (!raw) return [];
			if (Array.isArray(raw)) return raw.map(String);
			if (typeof raw === 'string') return raw.split(',').map((s) => s.trim());
			return [];
		})()
	);
</script>

<SEO
	title={data.node.title}
	description={data.node.description}
	image={data.kind === 'folder'
		? data.node.image
		: (data.node.frontmatter as { image?: string }).image}
	type={data.kind === 'folder' ? 'website' : 'article'}
	lang={data.lang}
	{keywords}
/>

{#if data.kind === 'folder'}
	<article class="article">
		<div class="crumbs-row">
			<Breadcrumbs breadcrumbs={data.breadcrumbs} current={data.node.title} />
			<Authors authors={data.authors} />
		</div>
		<header class="hero">
			<h1 class="main-header">{data.node.title}</h1>
			{#if data.node.description}<p class="hero-desc">
					{data.node.description}
				</p>{/if}
		</header>

		{#if data.html}
			<div class="md-content">
				<RenderedMarkdown html={data.html} />
			</div>
		{/if}

		{#if data.groups.contents.length}
			<h2 class="section">{t(data.lang, 'course.contents')}</h2>
			<ol class="list">
				{#each data.groups.contents as n}
					<li>
						<a
							class="list-link"
							class:module={n.kind === 'folder'}
							class:has-img={!!n.image}
							href={n.url}
						>
							{#if n.image}
								<img class="list-img" src={n.image} alt="" loading="lazy" />
							{/if}
							<span class="list-body">
								<span class="list-head">
									<span class="lt">{n.title}</span>
									<span class="list-icon">
										<Icon name={n.kind === 'folder' ? 'folder' : iconFor(n.type)} size={18} />
									</span>
								</span>
								{#if n.description}<span class="ld">{n.description}</span>{/if}
							</span>
						</a>
					</li>
				{/each}
			</ol>
		{/if}

		<NoteNav prev={data.prev} next={data.next} lang={data.lang} />
	</article>
{:else}
	<article class="article article-lecture">
		<div class="crumbs-row">
			<Breadcrumbs breadcrumbs={data.breadcrumbs} current={data.node.title} />
			<Authors authors={data.authors} />
		</div>
		<header class="hero">
			<h1 class="main-header">{data.node.title}</h1>
			<p class="hero-meta">{data.readingText}</p>
			<div class="hero-row">
				{#if data.node.description}<p class="hero-desc">
						{data.node.description}
					</p>{/if}
			</div>
		</header>

		<div class="md-content">
			{#if data.toc.length}<Toc items={data.toc} lang={data.lang} />{/if}
			<RenderedMarkdown html={data.html} />
		</div>

		<NoteNav prev={data.prev} next={data.next} lang={data.lang} />
	</article>
{/if}

<style>
	/* Breadcrumbs on the left, authors on the right; when tight the authors wrap
	   directly below the breadcrumbs (both share the row's left edge). */
	.crumbs-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding: 0 1rem;
	}
	.hero-row {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	/* The whole card is the link. Optional image on the left; icon + title on the
	   top row of the body, description below spanning the body's width. */
	.list-link {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: 0.8rem;
		padding: 0.6rem 0.6rem 0.6rem 1.2rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--secondary) 50%, transparent);
		box-shadow: 0 1px 3px var(--shadow-color);
		transition:
			background 0.2s,
			box-shadow 0.2s;
		color: var(--background-text);
	}
	.list-link:hover {
		background: color-mix(in srgb, var(--secondary) 95%, transparent);
		box-shadow: 0 6px 18px var(--shadow-color);
	}
	/* Modules stand out with a subtle accent tint and a folder icon, so the one
	   continuous list still reads "folder vs. page" at a glance. */
	.module {
		--mod-tint: color-mix(in srgb, var(--secondary) 80%, var(--accent));
		background: color-mix(in srgb, var(--mod-tint), transparent);
	}
	.module:hover {
		background: color-mix(in srgb, var(--mod-tint) 92%, transparent);
	}
	/* With an image, inset it evenly — left padding matches the top/bottom. */
	.has-img {
		padding-left: 0.6rem;
	}
	.list-img {
		flex: none;
		align-self: stretch;
		width: 3.5rem;
		object-fit: cover;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--secondary) 60%, transparent);
	}
	.list-body {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1;
		min-width: 0;
	}
	.list-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}
	/* Type icon, beside the title. */
	.list-icon {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
	}
	.lt {
		display: block;
		font-weight: 600;
		color: var(--background-text);
	}
	.ld {
		display: block;
		color: var(--muted);
		font-size: 0.95rem;
	}

	@media screen and (max-width: 768px) {
		.article-lecture {
			padding: 0 !important;
		}
	}
</style>
