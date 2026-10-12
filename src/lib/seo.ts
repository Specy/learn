import { toPlainText } from './content/plainText';
import { contentLang, isLang } from './languages';

const MAX_DESCRIPTION = 160;

/**
 * Plain-text description for a note without frontmatter `description`: the first paragraph
 * of its body, cut at a word boundary to at most MAX_DESCRIPTION characters.
 */
export function descriptionFromMarkdown(md: string): string {
	const text = toPlainText(
		md
			// headings are titles, not the opening prose
			.replace(/^\s*#{1,6}\s.*$/gm, '')
			// Obsidian wikilinks: [[target#heading|alias]] → alias, or the target when unaliased
			.replace(/\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, target, alias) =>
				(alias ?? target).trim()
			)
			// callout headers like "> [!note] Title" carry no prose
			.replace(/^\s*>?\s*\[![^\]]*\][+-]?.*$/gm, '')
	);
	const firstParagraph = text
		.split(/\n\s*\n/)
		.map((p) => p.replace(/\s+/g, ' ').trim())
		.find((p) => p.length > 0);
	if (!firstParagraph) return '';
	if (firstParagraph.length <= MAX_DESCRIPTION) return firstParagraph;

	const cut = firstParagraph.slice(0, MAX_DESCRIPTION - 1);
	const boundary = cut.lastIndexOf(' ');
	const head = (boundary > 0 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.\-–—]+$/, '');
	return `${head}…`;
}

/**
 * Note `<title>` text. Generic note titles ("Lezione 7", "Formulario") repeat across courses,
 * so the course name is appended unless the title already carries it.
 */
export function noteSeoTitle(title: string, courseTitle?: string): string {
	if (!courseTitle) return title;
	if (title.toLowerCase().includes(courseTitle.toLowerCase())) return title;
	return `${title} · ${courseTitle}`;
}

/** Splits a leading language segment off a pathname: `/en/fisica` → `{ lang: 'en', rest: '/fisica' }`. */
export function splitLangPath(pathname: string): { segment?: string; rest: string } {
	const [first, ...others] = pathname.split('/').filter(Boolean);
	return { segment: first, rest: others.length ? `/${others.join('/')}` : '' };
}

/** Rewrites a language-prefixed path onto the language that serves its content: `/en/x` → `/it/x`. */
export function canonicalPath(path: string): string {
	const { segment, rest } = splitLangPath(path);
	return isLang(segment) ? `/${contentLang(segment)}${rest}` : path;
}
