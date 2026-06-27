// rehypeMermaid.ts — runs BEFORE rehypeShiki
// Converts <pre><code class="language-mermaid">…</code></pre> into
// <pre class="mermaid-src">…</pre> so Shiki never sees it.
// RenderedMarkdown.svelte targets `.mermaid-src` to mount the Mermaid component.
import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

export default function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (
        node.tagName !== 'pre' ||
        !parent ||
        index === undefined
      ) return;

      const code = node.children.find(
        (c): c is Element =>
          c.type === 'element' &&
          c.tagName === 'code' &&
          Array.isArray(c.properties?.className) &&
          (c.properties.className as string[]).includes('language-mermaid')
      );
      if (!code) return;

      // Extract raw text source
      const source = code.children
        .filter((c) => c.type === 'text')
        .map((c) => (c as { value: string }).value)
        .join('');

      // Replace the <pre><code class="language-mermaid">…</code></pre>
      // with <pre class="mermaid-src">raw source</pre>
      (parent.children as Element[])[index] = {
        type: 'element',
        tagName: 'pre',
        properties: { className: ['mermaid-src'] },
        children: [{ type: 'text', value: source }]
      };
    });
  };
}
