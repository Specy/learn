<script lang="ts">
	import type { Tag } from '$lib/content/types';
	import { t } from '$lib/i18n';

	let { tags, lang, size = 'md' }: { tags?: Tag[]; lang: string; size?: 'sm' | 'md' } = $props();

	// Year pills are localized here (the tree stores the raw number) so the same
	// vault renders "1° anno" under /it and "Year 1" under /en.
	function label(tag: Tag): string {
		return tag.kind === 'year' ? t(lang, 'tag.year', { n: tag.year }) : tag.label;
	}
</script>

{#if tags?.length}
	<ul class="tags" class:sm={size === 'sm'}>
		{#each tags as tag}
			<li class="tag" class:year={tag.kind === 'year'}>{label(tag)}</li>
		{/each}
	</ul>
{/if}

<style>
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tag {
		font-family: var(--heading-font, sans-serif);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		white-space: nowrap;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		color: var(--muted);
		background: color-mix(in srgb, var(--secondary) 85%, transparent);
	}
	/* The year is the primary tag — accent it so it reads first in a row of pills. */
	.tag.year {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.sm .tag {
		font-size: 0.7rem;
		padding: 0.15rem 0.5rem;
	}
</style>
