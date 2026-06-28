// src/lib/search/anchors.test.ts
//
// Guards the load-bearing invariant: the section anchors produced by the
// build-time index (scripts/searchIndex.mjs splitSections) must equal the
// heading ids that the real render pipeline (rehype-slug) emits on the page,
// or "jump to heading" lands nowhere. Renders a tricky sample through the
// actual markdown processor and compares.
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '$lib/content/markdown';
import { splitSections } from '../../../scripts/searchIndex.mjs';

const noop = {
	note: (t: string) => t,
	asset: (t: string) => t,
	noteLabel: () => null
};

const SAMPLE = [
	'# Titolo Lezione',
	'intro',
	'## Tipi di successioni',
	'a',
	'## 🟢 Successione monotona',
	'b',
	'### Criterio del **rapporto**',
	'c',
	'## Forme indeterminate è già viste',
	'd',
	'## Tipi di successioni',
	'e',
	'```',
	'## non un heading',
	'```',
	'#### Coda'
].join('\n');

describe('section anchors match the render pipeline', () => {
	it('splitSections anchors equal rehype-slug heading ids (h1-h4)', async () => {
		const html = await renderMarkdown(SAMPLE, noop);
		const htmlIds = [...html.matchAll(/<h([1-4])[^>]*\bid="([^"]+)"/g)].map((m) => m[2]);
		const sectionAnchors = splitSections(SAMPLE)
			.filter((s: { heading: string | null }) => s.heading !== null)
			.map((s: { anchor: string }) => s.anchor);
		expect(sectionAnchors).toEqual(htmlIds);
	});
});
