// app/src/lib/content/markdown.ts
import { unified } from 'unified';
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

export function createProcessor(resolve: LinkResolver) {
	// `resolve` = { note(target):string, asset(target):string } link resolvers
	return unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkMath)
		.use(remarkObsidianLinks, resolve) // [[x]] / ![[x]] BEFORE remark-rehype
		.use(remarkCallouts) // > [!type] BEFORE remark-rehype
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(rehypeKatex)
		.use(rehypeSlug)
		.use(rehypeAutolinkHeadings, { behavior: 'wrap' })
		.use(rehypeMermaid)
		.use(rehypeShiki, {
			themes: { light: 'one-light', dark: 'one-dark-pro' },
			fallbackLanguage: 'text',
			defaultColor: false
		})
		.use(rehypeStringify, { allowDangerousHtml: true });
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
