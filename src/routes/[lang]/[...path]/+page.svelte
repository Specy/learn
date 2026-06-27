<script lang="ts">
	import type { PageProps } from "./$types"
	import CourseCard from "$lib/components/CourseCard.svelte"
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte"
	import NoteNav from "$lib/components/NoteNav.svelte"
	import Toc from "$lib/components/Toc.svelte"
	import { t } from "$lib/i18n"
	import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte"
	import SEO from "$lib/components/SEO.svelte"
	import Authors from "$lib/components/Authors.svelte"
	import Icon from "$lib/components/Icon.svelte"

	let { data }: PageProps = $props()

	// Icon per content type, shown to the left of each item in the unified list.
	function iconFor(type: string) {
		return type === "resource"
			? "paperclip"
			: type === "exercise"
				? "edit"
				: type === "exam"
					? "clipboard"
					: type === "summary"
						? "list"
						: "book" // lecture / default
	}

	const keywords = $derived(
		(() => {
			if (data.kind !== "note") return []
			const node = data.node as any
			const raw =
				node.frontmatter?.topics ||
				node.frontmatter?.tags ||
				node.frontmatter?.keywords
			if (!raw) return []
			if (Array.isArray(raw)) return raw.map(String)
			if (typeof raw === "string") return raw.split(",").map((s) => s.trim())
			return []
		})(),
	)
</script>

<SEO
	title={data.node.title}
	description={data.node.description}
	image={data.kind === "folder"
		? data.node.image
		: (data.node as any).frontmatter?.image}
	type={data.kind === "folder" ? "website" : "article"}
	lang={data.lang}
	{keywords}
/>

{#if data.kind === "folder"}
	<article class="article">
		<Breadcrumbs breadcrumbs={data.breadcrumbs} current={data.node.title} />
		<header class="hero">
			<h1 class="main-header">{data.node.title}</h1>
			{#if data.node.description}<p class="hero-desc">
					{data.node.description}
				</p>{/if}
		</header>
			<Authors authors={data.authors} />

		{#if data.html}
			<div class="md-content">
				<RenderedMarkdown html={data.html} />
			</div>
		{/if}

		{#if data.groups.modules.length}
			<h2 class="section">{t(data.lang, "course.modules")}</h2>
			<div class="grid">
				{#each data.groups.modules as m}
					<CourseCard
						title={m.title}
						description={m.description}
						image={m.image}
						url={m.url}
					/>
				{/each}
			</div>
		{/if}
		{#if data.groups.contents.length}
			<h2 class="section">{t(data.lang, "course.contents")}</h2>
			<ol class="list">
				{#each data.groups.contents as n}
					<li>
						<a class="list-link" href={n.url}>
							<span class="list-head">
								<span class="list-icon"><Icon name={iconFor(n.type)} size={18} /></span>
								<span class="lt">{n.title}</span>
							</span>
							{#if n.description}<span class="ld">{n.description}</span>{/if}
						</a>
					</li>
				{/each}
			</ol>
		{/if}

		<NoteNav prev={data.prev} next={data.next} lang={data.lang} />
	</article>
{:else}
	<article class="article article-lecture">
		<Breadcrumbs breadcrumbs={data.breadcrumbs} current={data.node.title} />
		<header class="hero">
			<h1 class="main-header">{data.node.title}</h1>
			<p class="hero-meta">{data.readingText}</p>
			<div class="hero-row">
				{#if data.node.description}<p class="hero-desc">
						{data.node.description}
					</p>{/if}
			</div>
		</header>
			<Authors authors={data.authors} />

		<div class="md-content">
			{#if data.toc.length}<Toc items={data.toc} lang={data.lang} />{/if}
			<RenderedMarkdown html={data.html} />
		</div>

		<NoteNav prev={data.prev} next={data.next} lang={data.lang} />
	</article>
{/if}

<style>
	.grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
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
	/* The whole card is the link (not just the title). Icon + title on the top
	   row, description below spanning the full width. */
	.list-link {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.6rem 0.9rem;
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
	.list-head {
		display: flex;
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
