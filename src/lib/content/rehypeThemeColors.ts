// rehypeThemeColors.ts — runs AFTER rehypeKatex
// `\textcolor{blue}{…}` makes KaTeX emit style="color:blue", which is unreadable
// on one of the two themes. Swap the palette's named colours for the matching
// theme-aware variable (defined in app.css, shared with ```plot) so notes keep
// plain LaTeX that still renders in Obsidian. Hex colours are left alone.
import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

const NAMED = /(^|;)(\s*color:\s*)(blue|red|green|orange|purple|teal)(\s*)(?=;|$)/g;

/** The same swap on an HTML string (```plot labels are inserted as raw HTML). */
export function themeColorsInHtml(html: string): string {
	return html.replace(
		/(style="(?:[^"]*;)?\s*color:\s*)(blue|red|green|orange|purple|teal)(?=\s*[;"])/g,
		'$1var(--palette-$2)'
	);
}

export default function rehypeThemeColors() {
	return (tree: Root) => {
		visit(tree, 'element', (node: Element) => {
			const style = node.properties?.style;
			if (typeof style !== 'string' || !style.includes('color')) return;
			node.properties.style = style.replace(NAMED, '$1$2var(--palette-$3)$4');
		});
	};
}
