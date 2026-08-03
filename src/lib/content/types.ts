/* eslint-disable @typescript-eslint/no-explicit-any */
export type NoteType = 'lecture' | 'resource' | 'exercise' | 'exam' | 'summary';

/**
 * Depth-derived role of a folder in the vault hierarchy:
 *
 *   root (synthetic) → cdl (corso di laurea) → course → module → module → …
 *
 * `level` only labels a folder; every level behaves the same structurally, so a
 * vault that is one level shallower still renders — the labels just shift.
 */
export type FolderLevel = 'root' | 'cdl' | 'course' | 'module';

/** Depth (number of url segments) at which folders become courses. */
export const COURSE_DEPTH = 2;

export function folderLevel(depth: number): FolderLevel {
	if (depth <= 0) return 'root';
	if (depth === 1) return 'cdl';
	if (depth === COURSE_DEPTH) return 'course';
	return 'module';
}

/**
 * A pill shown next to a course/module/note. `year` is rendered localized at
 * display time ("1° anno" / "Year 1"); `plain` carries free-form text verbatim.
 */
export type Tag = { kind: 'year'; year: number } | { kind: 'plain'; label: string };

export interface Author {
	name: string;
	link?: string; // optional URL opened on click
	image?: string; // optional avatar (vault asset basename or absolute URL/path)
}

export interface RawFile {
	relPath: string; // POSIX, e.g. '02-fisica/01-intro.md'
	frontmatter: Record<string, any>;
	content: string;
}
export interface NoteNode {
	kind: 'note';
	slug: string; // prefix-stripped, no ext
	path: string; // full url path, e.g. 'fisica/intro'
	relPath: string; // source path in the vault, e.g. '02-fisica/01-intro.md'
	order: number;
	title: string;
	description: string;
	type: NoteType;
	published: boolean;
	authors?: Author[];
	tags?: Tag[];
	content: string; // raw markdown body
	frontmatter: Record<string, any>;
}
export interface FolderNode {
	kind: 'folder';
	slug: string;
	path: string;
	relPath?: string; // source index.md path (undefined for the synthetic root)
	level: FolderLevel; // derived from depth: root → cdl → course → module
	order: number;
	title: string;
	description: string;
	image?: string;
	authors?: Author[];
	tags?: Tag[];
	published: boolean;
	content: string; // index.md body
	children: ContentNode[];
	_hasIndex?: boolean;
}
export type ContentNode = FolderNode | NoteNode;
