// rehypePlot.ts — runs BEFORE rehypeShiki
// Converts <pre><code class="language-plot">…</code></pre> into the static SVG
// figure from renderPlot. A broken spec renders as a visible error block and is
// reported as a vfile message, which scripts/checkContent.mjs turns into a failure.
import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import type { VFile } from 'vfile';
import { renderPlot } from './renderPlot';

/** Stable across builds so prerendered pages don't churn. */
function hash(s: string): string {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
	return (h >>> 0).toString(36);
}

export default function rehypePlot() {
	return (tree: Root, file: VFile) => {
		let count = 0;
		visit(tree, 'element', (node: Element, index, parent) => {
			if (node.tagName !== 'pre' || !parent || index === undefined) return;
			const code = node.children.find(
				(c): c is Element =>
					c.type === 'element' &&
					c.tagName === 'code' &&
					Array.isArray(c.properties?.className) &&
					(c.properties.className as string[]).includes('language-plot')
			);
			if (!code) return;

			const source = code.children
				.filter((c) => c.type === 'text')
				.map((c) => (c as { value: string }).value)
				.join('');

			let html: string;
			try {
				html = renderPlot(source, `plot-${hash(source)}-${count++}`);
			} catch (e) {
				const reason = e instanceof Error ? e.message : String(e);
				file.message(`plot: ${reason}`, node.position);
				(parent.children as Element[])[index] = {
					type: 'element',
					tagName: 'pre',
					properties: { className: ['plot-error'] },
					children: [{ type: 'text', value: `plot: ${reason}\n\n${source}` }]
				};
				return;
			}
			// A raw node: rehype-raw has already run, and rehype-stringify (with
			// allowDangerousHtml) emits it verbatim.
			(parent.children as unknown[])[index] = { type: 'raw', value: html };
		});
	};
}
