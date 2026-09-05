// app/src/lib/content/markdown.ts
import { unified } from 'unified';
import type { Nodes, Root } from 'hast';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import remarkObsidianLinks from './remarkObsidianLinks.js';
import remarkCallouts from './remarkCallouts.js';
import rehypeMermaid from './rehypeMermaid.js';

export type LinkResolver = {
	note(target: string): string;
	asset(target: string): string;
	noteLabel(target: string): string | null;
};

/**
 * Notes are written with `#` for their top-level sections, but the page template
 * already renders the note title as the document's <h1>. Shifting every heading down
 * one level leaves a single <h1> per page and — because extractToc only collects h2
 * and deeper — is also what makes those top-level sections show up in the table of
 * contents at all.
 */
function rehypeDemoteHeadings() {
	return (tree: Root) => {
		const walk = (node: Nodes) => {
			if (node.type === 'element') {
				const level = /^h([1-5])$/.exec(node.tagName);
				if (level) node.tagName = `h${Number(level[1]) + 1}`;
			}
			if ('children' in node) node.children.forEach(walk);
		};
		walk(tree);
	};
}

export function createProcessor(resolve: LinkResolver) {
	// `resolve` = { note(target):string, asset(target):string } link resolvers
	return (
		unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkMath)
			.use(remarkObsidianLinks, resolve) // [[x]] / ![[x]] BEFORE remark-rehype
			.use(remarkCallouts) // > [!type] BEFORE remark-rehype
			.use(remarkRehype, { allowDangerousHtml: true })
			.use(rehypeRaw)
			.use(rehypeKatex)
			// before rehypeSlug so ids land on the final heading elements
			.use(rehypeDemoteHeadings)
			.use(rehypeSlug)
			.use(rehypeAutolinkHeadings, { behavior: 'wrap' })
			.use(rehypeMermaid)
			.use(rehypeShiki, {
				themes: { light: 'one-light', dark: 'one-dark-pro' },
				fallbackLanguage: 'text',
				defaultColor: false
			})
			.use(rehypeStringify, { allowDangerousHtml: true })
	);
}

/**
 * Obsidian renders a standalone single-line `$$ … $$` as DISPLAY math, but
 * micromark-extension-math only treats the multi-line `$$\n…\n$$` form as a
 * display block (single-line `$$…$$` becomes inline). Normalize lines that are
 * solely a `$$ … $$` equation into the block form so they render centered,
 * keeping the vault itself Obsidian-idiomatic.
 */
export function normalizeBlockMath(md: string): string {
	return md.replace(
		/^[ \t]*\$\$[ \t]*([^\n]+?)[ \t]*\$\$[ \t]*$/gm,
		(_m, body) => `$$\n${body}\n$$`
	);
}

export async function renderMarkdown(md: string, resolve: LinkResolver): Promise<string> {
	return String(await createProcessor(resolve).process(normalizeBlockMath(md)));
}
