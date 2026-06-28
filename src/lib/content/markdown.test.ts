// app/src/lib/content/markdown.test.ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown, normalizeBlockMath } from './markdown';

const resolve = {
	note: (t: string) => `/${t}`,
	asset: (t: string) => `/vault-assets/${t}`,
	noteLabel: (_t: string) => null
};

describe('renderMarkdown', () => {
	it('renders headings with slugs', async () => {
		const html = await renderMarkdown('# Ciao Mondo', resolve);
		expect(html).toContain('id="ciao-mondo"');
	}, 30000);
	it('renders inline KaTeX math', async () => {
		const html = await renderMarkdown('Sia $x^2$ il quadrato', resolve);
		expect(html).toContain('class="katex"');
	});
	it('highlights fenced code with Shiki (dual-theme vars)', async () => {
		const html = await renderMarkdown('```js\nconst a = 1;\n```', resolve);
		expect(html).toContain('class="shiki');
		expect(html).toContain('--shiki-dark');
	});
	it('renders GFM tables', async () => {
		const html = await renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |', resolve);
		expect(html).toContain('<table>');
	});
	it('renders a standalone single-line $$…$$ as centered display math', async () => {
		const html = await renderMarkdown('$$x = x(t)$$', resolve);
		expect(html).toContain('katex-display');
	});
	it('leaves inline single-dollar math inline', async () => {
		const html = await renderMarkdown('vale $a$ qui', resolve);
		expect(html).toContain('class="katex"');
		expect(html).not.toContain('katex-display');
	});
	it('converts mermaid fenced block to .mermaid-src (not shiki-highlighted)', async () => {
		const html = await renderMarkdown('```mermaid\ngraph TD;A-->B\n```', resolve);
		// Must be wrapped in our stable selector, not a shiki block
		expect(html).toContain('class="mermaid-src"');
		expect(html).not.toContain('class="shiki');
		// Raw source must be preserved inside
		expect(html).toContain('graph TD;A-->B');
	});
});

describe('normalizeBlockMath', () => {
	it('expands a standalone single-line $$…$$ to the block form', () => {
		expect(normalizeBlockMath('$$x = x(t)$$')).toBe('$$\nx = x(t)\n$$');
	});
	it('does not touch $$ that share a line with other text', () => {
		const line = 'inline $$a$$ within text';
		expect(normalizeBlockMath(line)).toBe(line);
	});
	it('leaves single-dollar inline math untouched', () => {
		expect(normalizeBlockMath('vale $a$ qui')).toBe('vale $a$ qui');
	});
});
