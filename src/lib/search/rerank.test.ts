// src/lib/search/rerank.test.ts
import { describe, it, expect } from 'vitest';
import {
	rerank,
	scopeOf,
	cdlOf,
	inSearchScope,
	buildUrl,
	makeSnippet,
	type RankInput
} from './rerank';
import type { SearchEntry, SearchContext } from './types';

function entry(p: Partial<SearchEntry> & { id: number }): SearchEntry {
	return {
		id: p.id,
		kind: p.kind ?? 'section',
		course: p.course ?? 'info/fisica',
		courseTitle: p.courseTitle ?? 'Fisica',
		notePath: p.notePath ?? 'info/fisica/intro',
		noteTitle: p.noteTitle ?? 'Intro',
		heading: p.heading ?? 'H',
		anchor: p.anchor ?? 'h',
		text: p.text ?? 'body text'
	};
}
const hit = (e: SearchEntry, score: number, matches?: RankInput['matches']): RankInput => ({
	item: e,
	score,
	matches
});

const ctxLecture: SearchContext = {
	lang: 'it',
	cdl: 'info',
	course: 'info/fisica',
	notePath: 'info/fisica/intro'
};
const ctxHome: SearchContext = { lang: 'it', cdl: '', course: '', notePath: '' };

describe('scopeOf', () => {
	it('tags current / same-course / other', () => {
		expect(scopeOf(entry({ id: 1, notePath: 'info/fisica/intro' }), ctxLecture)).toBe('current');
		expect(scopeOf(entry({ id: 2, notePath: 'info/fisica/altro' }), ctxLecture)).toBe(
			'same-course'
		);
		expect(
			scopeOf(entry({ id: 3, course: 'info/analisi', notePath: 'info/analisi/x' }), ctxLecture)
		).toBe('other');
	});
	it('on the home context nothing is current/same-course', () => {
		expect(scopeOf(entry({ id: 1, notePath: 'info/fisica/intro' }), ctxHome)).toBe('other');
	});
	it('a cdl context covers every course beneath it', () => {
		const ctxCdl: SearchContext = { lang: 'it', cdl: 'info', course: 'info', notePath: 'info' };
		expect(scopeOf(entry({ id: 1, course: 'info/reti', notePath: 'info/reti/a' }), ctxCdl)).toBe(
			'same-course'
		);
		// a sibling cdl must not be pulled in by a shared prefix
		expect(scopeOf(entry({ id: 2, course: 'informatica-magistrale' }), ctxCdl)).toBe('other');
	});
});

describe('cdl confinement', () => {
	it('cdlOf reads the leading path segment', () => {
		expect(cdlOf(entry({ id: 1, notePath: 'info/reti/tcp' }))).toBe('info');
		expect(cdlOf(entry({ id: 2, notePath: 'solo' }))).toBe('solo');
	});

	it('keeps only the active cdl, and everything on the home context', () => {
		const other = entry({ id: 1, course: 'bio/genetica', notePath: 'bio/genetica/dna' });
		expect(inSearchScope(other, ctxLecture)).toBe(false);
		expect(inSearchScope(entry({ id: 2 }), ctxLecture)).toBe(true);
		expect(inSearchScope(other, ctxHome)).toBe(true);
	});

	it('rerank drops out-of-cdl hits even when they score better', () => {
		const hits = [
			hit(
				entry({ id: 1, noteTitle: 'DNA', course: 'bio/genetica', notePath: 'bio/genetica/dna' }),
				0.01
			),
			hit(entry({ id: 2, noteTitle: 'Intro' }), 0.9)
		];
		expect(rerank(hits, ctxLecture).map((r) => r.noteTitle)).toEqual(['Intro']);
		// …but the home page still searches the whole vault, best score first
		expect(rerank(hits, ctxHome).map((r) => r.noteTitle)).toEqual(['DNA', 'Intro']);
	});
});

describe('buildUrl', () => {
	it('language-prefixes and appends the anchor', () => {
		expect(buildUrl(entry({ id: 1, notePath: 'info/fisica/intro', anchor: 'calore' }), 'it')).toBe(
			'/it/info/fisica/intro#calore'
		);
	});
	it('omits the hash for file/intro entries', () => {
		expect(buildUrl(entry({ id: 1, notePath: 'info/fisica/intro', anchor: '' }), 'en')).toBe(
			'/en/info/fisica/intro'
		);
	});
	it('falls back to it when lang is empty', () => {
		expect(buildUrl(entry({ id: 1, notePath: 'x', anchor: '' }), '')).toBe('/it/x');
	});
});

describe('rerank ordering', () => {
	it('current beats same-course beats other at equal raw score', () => {
		const hits = [
			hit(entry({ id: 1, course: 'info/analisi', notePath: 'info/analisi/a' }), 0.3),
			hit(entry({ id: 2, course: 'info/fisica', notePath: 'info/fisica/b' }), 0.3),
			hit(entry({ id: 3, course: 'info/fisica', notePath: 'info/fisica/intro' }), 0.3)
		];
		const res = rerank(hits, ctxLecture);
		expect(res.map((r) => r.scope)).toEqual(['current', 'same-course', 'other']);
	});

	it('a strong out-of-context match can outrank a weak current match', () => {
		const hits = [
			hit(
				entry({
					id: 1,
					kind: 'file',
					course: 'info/analisi',
					notePath: 'info/analisi/termo',
					noteTitle: 'Termodinamica'
				}),
				0.02
			),
			hit(entry({ id: 2, notePath: 'info/fisica/intro' }), 0.5)
		];
		const res = rerank(hits, ctxLecture);
		expect(res[0].noteTitle).toBe('Termodinamica'); // 0.02 < 0.5*0.3=0.15
		expect(res[0].scope).toBe('other');
	});

	it('a file-name hit outranks a same-note section at equal raw score', () => {
		const hits = [
			hit(
				entry({
					id: 1,
					kind: 'section',
					notePath: 'info/analisi/derivate',
					anchor: 'x',
					heading: 'Caso n>1'
				}),
				0.05
			),
			hit(
				entry({
					id: 2,
					kind: 'file',
					notePath: 'info/analisi/derivate',
					anchor: '',
					noteTitle: 'Derivate'
				}),
				0.05
			)
		];
		const res = rerank(hits, ctxLecture);
		expect(res[0].kind).toBe('file');
		expect(res[0].noteTitle).toBe('Derivate');
	});

	it('home context applies no boost (pure raw score order)', () => {
		const hits = [
			hit(entry({ id: 1, notePath: 'info/fisica/intro' }), 0.4),
			hit(entry({ id: 2, course: 'info/analisi', notePath: 'info/analisi/a' }), 0.1)
		];
		const res = rerank(hits, ctxHome);
		expect(res[0].url).toContain('analisi');
		expect(res.every((r) => r.scope === 'other')).toBe(true);
	});
});

describe('rerank dedup', () => {
	it('caps other notes at 2 section results but never caps the current note', () => {
		const hits = [
			// current note: 3 sections, all should survive
			hit(entry({ id: 1, notePath: 'info/fisica/intro', anchor: 'a' }), 0.1),
			hit(entry({ id: 2, notePath: 'info/fisica/intro', anchor: 'b' }), 0.11),
			hit(entry({ id: 3, notePath: 'info/fisica/intro', anchor: 'c' }), 0.12),
			// another note: 3 sections, only 2 should survive
			hit(entry({ id: 4, course: 'info/analisi', notePath: 'info/analisi/x', anchor: 'a' }), 0.1),
			hit(entry({ id: 5, course: 'info/analisi', notePath: 'info/analisi/x', anchor: 'b' }), 0.11),
			hit(entry({ id: 6, course: 'info/analisi', notePath: 'info/analisi/x', anchor: 'c' }), 0.12)
		];
		const res = rerank(hits, ctxLecture, 10);
		const current = res.filter((r) => r.scope === 'current');
		const otherX = res.filter((r) => r.url.includes('analisi/x'));
		expect(current.length).toBe(3);
		expect(otherX.length).toBe(2);
	});

	it('does not cap file entries', () => {
		const hits = [
			hit(
				entry({
					id: 1,
					kind: 'file',
					course: 'info/analisi',
					notePath: 'info/analisi/x',
					anchor: ''
				}),
				0.1
			),
			hit(
				entry({
					id: 2,
					kind: 'section',
					course: 'info/analisi',
					notePath: 'info/analisi/x',
					anchor: 'a'
				}),
				0.11
			),
			hit(
				entry({
					id: 3,
					kind: 'section',
					course: 'info/analisi',
					notePath: 'info/analisi/x',
					anchor: 'b'
				}),
				0.12
			),
			hit(
				entry({
					id: 4,
					kind: 'section',
					course: 'info/analisi',
					notePath: 'info/analisi/x',
					anchor: 'c'
				}),
				0.13
			)
		];
		const res = rerank(hits, ctxLecture, 10);
		// file + 2 sections = 3 from the same other note
		expect(res.filter((r) => r.url.includes('analisi/x')).length).toBe(3);
		expect(res.some((r) => r.kind === 'file')).toBe(true);
	});

	it('respects the limit', () => {
		const hits = Array.from({ length: 20 }, (_, i) =>
			hit(entry({ id: i, course: 'c' + i, notePath: 'c' + i + '/n' }), 0.1 + i * 0.01)
		);
		expect(rerank(hits, ctxHome, 10).length).toBe(10);
	});
});

describe('makeSnippet', () => {
	it('returns short text as the excerpt with nothing highlighted', () => {
		expect(makeSnippet(entry({ id: 1, text: 'short body' }))).toEqual({
			before: '',
			hit: '',
			after: 'short body'
		});
	});

	it('positions the match about a third in, with more context after', () => {
		const long = 'a'.repeat(200) + ' TARGET ' + 'b'.repeat(200);
		const start = 201; // 'T'
		const end = 206; //   'T' of TARGET (inclusive)
		const s = makeSnippet(entry({ id: 1, text: long }), [
			{ key: 'text', value: long, indices: [[start, end]] }
		]);
		expect(s.hit).toBe('TARGET'); // correct alignment: exact matched substring
		expect(s.before.startsWith('…')).toBe(true);
		expect(s.after.endsWith('…')).toBe(true);
		// match sits ~1/3 in → more context after than before
		expect(s.after.length).toBeGreaterThan(s.before.length);
	});

	it('selects the LONGEST matched range, not the first', () => {
		const text = 'xx ab yy abcdef zz';
		const s = makeSnippet(entry({ id: 1, text }), [
			{
				key: 'text',
				value: text,
				indices: [
					[3, 4],
					[9, 14]
				]
			}
		]);
		expect(s.hit).toBe('abcdef');
	});

	it('caps the excerpt length when there is no match', () => {
		const long = 'a '.repeat(200);
		const s = makeSnippet(entry({ id: 1, text: long }));
		expect(s.hit).toBe('');
		expect(s.before).toBe('');
		expect(s.after.endsWith('…')).toBe(true);
		expect(s.after.length).toBeLessThanOrEqual(141);
	});
});
