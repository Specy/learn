<script lang="ts">
	import { t } from '$lib/i18n';
	let {
		items,
		lang = 'it'
	}: { items: { id: string; text: string; depth: number }[]; lang?: string } = $props();
</script>

<nav aria-label="Table of contents" class="toc">
	<p class="toc-title">{t(lang, 'note.toc')}</p>
	<ul>
		{#each items as item}
			<li style="padding-left: {(item.depth - 1) * 1}rem">
				<a href="#{item.id}">{item.text}</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.toc {
		border-left: 0.2rem solid var(--accent);
		padding: 0.5rem 1rem;
		margin: 1rem 0 3rem 0rem;
		font-size: 0.875rem;
		background: color-mix(in srgb, var(--background) 40%, transparent);
		width: 100%;
		border-radius: 0.2rem 0.8rem 0.8rem 0.2rem;
	}
	.toc-title {
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--background-text);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	a {
		color: var(--hint);
		text-decoration: none;
	}
	a:hover {
		color: var(--accent);
		text-decoration: underline;
	}
</style>
