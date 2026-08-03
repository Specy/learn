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
	import Tags from '$lib/components/Tags.svelte';

	let { data }: PageProps = $props();

	// A CDL lists degree courses; anything deeper lists lectures/modules.
	const contentsLabel = $derived(
		data.kind === 'folder' && data.node.level === 'cdl'
			? t(data.lang, 'cdl.courses')
			: t(data.lang, 'course.contents')
	);

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
			<div class="crumbs-left">
				<Breadcrumbs breadcrumbs={data.breadcrumbs} current={data.node.title} />
			</div>
			<Authors authors={data.authors} />
		</div>
		<header class="hero">
			<h1 class="main-header">{data.node.title}</h1>
			{#if data.node.description}<p class="hero-desc">
					{data.node.description}
				</p>{/if}
			<Tags tags={data.node.tags} lang={data.lang} />
		</header>

		{#if data.html}
			<div class="md-content">
				<RenderedMarkdown html={data.html} />
			</div>
		{/if}

		{#if data.groups.contents.length}
			<h2 class="section">{contentsLabel}</h2>
			<ol class="list">
				{#each data.groups.contents as n}
					{@const yearTags = (n.tags ?? []).filter((tag) => tag.kind === 'year')}
					{@const otherTags = (n.tags ?? []).filter((tag) => tag.kind !== 'year')}
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
							<div class="list-body">
								<div class="list-head">
									<span class="lt">{n.title}</span>
									<!-- The year rides the title row (it scans as a column down the
									     list); any other tag sits under the description. -->
									<Tags tags={yearTags} lang={data.lang} size="sm" />
									<span class="list-icon">
										<Icon name={n.kind === 'folder' ? 'folder' : iconFor(n.type)} size={18} />
									</span>
								</div>
								{#if n.description}<span class="ld">{n.description}</span>{/if}
								<Tags tags={otherTags} lang={data.lang} size="sm" />
							</div>
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
			{#if data.lecturePos && data.lecturePos.total > 1}
				<span
					class="lecture-pos"
					aria-label={`${t(data.lang, 'note.lecture')} ${data.lecturePos.index}/${
						data.lecturePos.total
					}`}
				>
					{data.lecturePos.index} / {data.lecturePos.total}
				</span>
			{/if}
			<div style="margin-left: auto;">
				<Authors authors={data.authors} />
			</div>
		</div>
		<header class="hero">
			<h1 class="main-header">{data.node.title}</h1>
			<div class="hero-row">
				{#if data.node.description}<p class="hero-desc">
						{data.node.description}
					</p>{/if}
			</div>
			<Tags tags={data.node.tags} lang={data.lang} />
		</header>

		<div class="md-content">
			{#if data.toc.length}<Toc items={data.toc} lang={data.lang} />{/if}
			<RenderedMarkdown html={data.html} />
		</div>

		<NoteNav prev={data.prev} next={data.next} lang={data.lang} />
	</article>
{/if}

<style>
	/* Breadcrumbs (+ lecture pill) grow on the left; authors keep their own column
	   pinned to the right at every width. The left group wraps internally — the
	   pill drops below the breadcrumbs — but never pushes authors to a new line. */
	.crumbs-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.8rem;
		padding: 0 1rem;
	}
	.hero-row {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	/* Breadcrumbs + the lecture-position pill, grouped on the left; the pill sits
	   just right of the breadcrumbs and wraps below them when space is tight.
	   min-width:0 keeps the breadcrumb ellipsis working inside the wrapper. */
	.crumbs-left {
		flex: 1 1 auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.8rem;
		min-width: 0;
	}
	/* "current lecture / total in this folder" — a small accent pill sized to sit
	   inline with the breadcrumb pill. */
	.lecture-pos {
		flex: none;
		font-family: var(--heading-font, sans-serif);
		font-weight: 700;
		font-size: 0.82rem;
		letter-spacing: 0.02em;
		white-space: nowrap;
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
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
	/* Title, then the year pill, then the type icon pinned right (margin-left:auto
	   on the icon, so the pill stays adjacent to the title rather than drifting). */
	.list-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.6rem;
		min-width: 0;
	}
	/* Type icon, beside the title. */
	.list-icon {
		flex: none;
		margin-left: auto;
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
