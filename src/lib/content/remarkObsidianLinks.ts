// app/src/lib/content/remarkObsidianLinks.ts
import { visit } from 'unist-util-visit';
import type { LinkResolver } from './markdown';
import { decodeExcalidrawSentinel, EXCALIDRAW_SENTINEL_PREFIX } from './context';

const WIKILINK = /(!)?\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** Wikilink labels default to the note title, which can get long — clamp the
 * visible text (the full label stays in the link's title attribute). */
const MAX_LABEL = 32;

/** Escape special HTML attribute characters to prevent injection. */
function escAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function remarkObsidianLinks(resolve: LinkResolver) {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
      if (!parent || index === undefined || !node.value.includes('[[')) return;
      WIKILINK.lastIndex = 0;
      const out: any[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = WIKILINK.exec(node.value)) !== null) {
        const [full, bang, target, alias] = m;
        if (m.index > last) out.push({ type: 'text', value: node.value.slice(last, m.index) });
        if (bang) {
          const assetUrl = resolve.asset(target.trim());
          const altText = (alias ?? target).trim();

          // Check if this is an excalidraw dual-theme sentinel
          const excalidraw = decodeExcalidrawSentinel(assetUrl);
          if (excalidraw !== null) {
            if (excalidraw.light || excalidraw.dark) {
              // Emit two <img> tags toggled by CSS via html[data-theme="dark"],
              // matching the site's in-app theme toggle (same as Shiki/KaTeX).
              const lightUrl = escAttr(excalidraw.light ?? excalidraw.dark ?? '');
              const darkUrl = escAttr(excalidraw.dark ?? excalidraw.light ?? '');
              const alt = escAttr(altText);
              out.push({
                type: 'html',
                value: `<span class="excalidraw-embed"><img src="${lightUrl}" alt="${alt}" class="excalidraw-img excalidraw-light"><img src="${darkUrl}" alt="${alt}" class="excalidraw-img excalidraw-dark"></span>`
              });
            } else {
              // Missing excalidraw — render a placeholder span
              out.push({
                type: 'html',
                value: `<span class="excalidraw-missing" title="${escAttr(altText)}">[excalidraw: ${escAttr(altText)}]</span>`
              });
            }
          } else {
            // Regular image asset — use an HTML node so rehype-raw passes the src
            // verbatim (no percent-encoding by unified's image → hast conversion).
            out.push({
              type: 'html',
              value: `<img src="${escAttr(assetUrl)}" alt="${escAttr(altText)}">`
            });
          }
        } else {
          const trimmedTarget = target.trim();
          const label = (alias ?? resolve.noteLabel?.(trimmedTarget) ?? trimmedTarget).trim();
          const display = label.length > MAX_LABEL ? label.slice(0, MAX_LABEL).trimEnd() + '…' : label;
          out.push({
            type: 'link',
            url: resolve.note(trimmedTarget),
            // Keep the full label reachable on hover only when we truncated it.
            title: display === label ? null : label,
            children: [{ type: 'text', value: display }]
          });
        }
        last = m.index + full.length;
      }
      if (last < node.value.length) out.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...out);
      return index + out.length; // skip inserted nodes
    });
  };
}
