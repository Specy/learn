// src/lib/search/types.ts
// Shared types for the client search subsystem (index entry / result / worker RPC).

export type SearchEntryKind = 'file' | 'section';

/** One indexed unit. Built by scripts/searchIndex.mjs, shipped lz-compressed. */
export interface SearchEntry {
	id: number;
	kind: SearchEntryKind;
	course: string; // top-level url slug, '' for root-level pages
	courseTitle: string; // display name of the course (folder index title)
	notePath: string; // language-agnostic url path, e.g. 'analisi/serie'
	noteTitle: string;
	heading: string | null; // section heading (null for file/intro entries)
	anchor: string; // '' for file/intro, slug id for sections
	text: string; // searchable body / snippet source
}

export type ResultScope = 'current' | 'same-course' | 'other';

/**
 * A preview snippet split around the matched text so the UI can highlight the
 * match and centre it: `before` + `hit` (the matched text) + `after`. For a
 * non-text match (or no match) `hit` is '' and the excerpt is in `after`.
 */
export interface SearchSnippet {
	before: string;
	hit: string;
	after: string;
}

/** Where the user currently is, used to rerank and to build language-scoped urls. */
export interface SearchContext {
	lang: string;
	course: string; // '' when on the language home / no course
	notePath: string; // '' when not inside a note
}

/** A ranked result handed to the UI. */
export interface SearchResult {
	kind: SearchEntryKind;
	scope: ResultScope;
	noteTitle: string;
	courseTitle: string;
	heading: string | null;
	url: string; // /{lang}/{notePath}{#anchor}
	snippet: SearchSnippet;
}

// ─── Worker RPC ──────────────────────────────────────────────────────────────

export interface SyncRequest {
	id: number;
	type: 'sync';
	url: string;
}
export interface SearchRequest {
	id: number;
	type: 'search';
	query: string;
	context: SearchContext;
	limit: number;
}
export type WorkerRequest = SyncRequest | SearchRequest;

export interface WorkerOk<T = unknown> {
	id: number;
	ok: true;
	result?: T;
}
export interface WorkerErr {
	id: number;
	ok: false;
	error: string;
}
export type WorkerResponse<T = unknown> = WorkerOk<T> | WorkerErr;
