// app/src/lib/content/tree.ts
import { parseEntryName, stripMdExt } from './slug';
import { folderLevel } from './types';
import type { RawFile, FolderNode, NoteNode, ContentNode, NoteType, Author, Tag } from './types';

const BIG = Number.MAX_SAFE_INTEGER;

/** Normalize the frontmatter `authors` field to Author[] (undefined if none). */
export function parseAuthors(raw: unknown): Author[] | undefined {
	if (!raw) return undefined;
	const arr = Array.isArray(raw) ? raw : [raw];
	const out: Author[] = [];
	for (const a of arr) {
		if (typeof a === 'string' && a.trim()) {
			out.push({ name: a.trim() });
		} else if (a && typeof a === 'object') {
			const obj = a as Record<string, unknown>;
			if (obj.name) {
				out.push({
					name: String(obj.name),
					link: obj.link ? String(obj.link) : undefined,
					image: obj.image ? String(obj.image) : undefined
				});
			}
		}
	}
	return out.length ? out : undefined;
}

/**
 * Normalize the display tags of a node from its frontmatter (undefined if none).
 *
 * `year: 2` becomes a localized year pill; `tags: [a, b]` (or a comma-separated
 * string) become free-form pills, in the order written. `topics`/`keywords` are
 * deliberately NOT read here — those stay SEO-only keywords.
 */
export function parseTags(fm: Record<string, unknown>): Tag[] | undefined {
	const out: Tag[] = [];

	const year = typeof fm.year === 'string' ? Number(fm.year.trim()) : fm.year;
	if (typeof year === 'number' && Number.isFinite(year)) out.push({ kind: 'year', year });

	const raw = fm.tags;
	const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
	for (const item of list) {
		const label = String(item ?? '').trim();
		if (label) out.push({ kind: 'plain', label });
	}

	return out.length ? out : undefined;
}

function emptyFolder(slug: string, path: string, order: number, depth: number): FolderNode {
	return {
		kind: 'folder',
		slug,
		path,
		level: folderLevel(depth),
		order,
		title: slug,
		description: '',
		published: true,
		content: '',
		children: []
	};
}

export function buildTree(files: RawFile[]): FolderNode {
	const root = emptyFolder('', '', 0, 0);

	// 1) ensure folder chain exists for each file, then place notes / index.md
	for (const file of files) {
		const parts = file.relPath.split('/');
		const fileName = parts.pop()!;
		let cursor = root;
		const urlSegs: string[] = [];

		for (const dir of parts) {
			const { order, slug } = parseEntryName(dir);
			urlSegs.push(slug);
			let next = cursor.children.find(
				(c): c is FolderNode => c.kind === 'folder' && c.slug === slug
			);
			if (!next) {
				next = emptyFolder(slug, urlSegs.join('/'), order ?? BIG, urlSegs.length);
				next.published = false; // becomes true only when index.md seen
				cursor.children.push(next);
			}
			cursor = next;
		}

		if (stripMdExt(fileName) === 'index') {
			cursor.relPath = file.relPath;
			cursor.title = file.frontmatter.title ?? cursor.slug;
			cursor.description = file.frontmatter.description ?? '';
			cursor.image = file.frontmatter.image;
			cursor.authors = parseAuthors(file.frontmatter.authors);
			cursor.tags = parseTags(file.frontmatter);
			cursor.order = file.frontmatter.order ?? cursor.order;
			cursor.published = file.frontmatter.published ?? true; // navigable now
			cursor.content = file.content;
			cursor._hasIndex = true;
		} else {
			const { order, slug } = parseEntryName(stripMdExt(fileName));
			const note: NoteNode = {
				kind: 'note',
				slug,
				path: [...urlSegs, slug].join('/'),
				relPath: file.relPath,
				order: file.frontmatter.order ?? order ?? BIG,
				title: file.frontmatter.title ?? slug,
				description: file.frontmatter.description ?? '',
				type: (file.frontmatter.type as NoteType) ?? 'lecture',
				published: file.frontmatter.published ?? true,
				authors: parseAuthors(file.frontmatter.authors),
				tags: parseTags(file.frontmatter),
				content: file.content,
				frontmatter: file.frontmatter
			};
			cursor.children.push(note);
		}
	}

	// 2) prune non-navigable folders (no index.md) and sort
	pruneAndSort(root);
	return root;
}

function pruneAndSort(folder: FolderNode) {
	folder.children = folder.children.filter((c) => {
		if (c.kind === 'note') return c.published;
		const navigable = c._hasIndex === true;
		if (navigable) pruneAndSort(c);
		return navigable && c.published;
	});
	folder.children.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export function getNodeByPath(root: FolderNode, segments: string[]): ContentNode | null {
	let cursor: ContentNode = root;
	for (const seg of segments) {
		if (cursor.kind !== 'folder') return null;
		const next: ContentNode | undefined = cursor.children.find((c) => c.slug === seg);
		if (!next) return null;
		cursor = next;
	}
	return cursor;
}

export function groupChildren(folder: FolderNode) {
	// `all` keeps the folder's natural order — modules (folders) and notes
	// interleaved by prefix/order — so the page renders ONE continuous list with
	// folders tinted + a folder icon and notes a per-type icon, nothing split.
	// `modules` (folders only) still feeds the homepage CDL grid.
	return {
		modules: folder.children.filter((c): c is FolderNode => c.kind === 'folder'),
		notes: folder.children.filter((c): c is NoteNode => c.kind === 'note'),
		all: folder.children
	};
}

export function listRoutes(root: FolderNode): { path: string }[] {
	const out: { path: string }[] = [];
	const walk = (f: FolderNode) => {
		for (const c of f.children) {
			out.push({ path: c.path });
			if (c.kind === 'folder') walk(c);
		}
	};
	walk(root);
	return out;
}
