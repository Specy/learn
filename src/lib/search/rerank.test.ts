// src/lib/search/rerank.test.ts
import { describe, it, expect } from 'vitest';
import { rerank, scopeOf, buildUrl, makeSnippet, type RankInput } from './rerank';
import type { SearchEntry, SearchContext } from './types';

function entry(p: Partial<SearchEntry> & { id: number }): SearchEntry {
  return {
    id: p.id,
    kind: p.kind ?? 'section',
    course: p.course ?? 'fisica',
    courseTitle: p.courseTitle ?? 'Fisica',
    notePath: p.notePath ?? 'fisica/intro',
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

const ctxLecture: SearchContext = { lang: 'it', course: 'fisica', notePath: 'fisica/intro' };
const ctxCourse: SearchContext = { lang: 'it', course: 'fisica', notePath: 'fisica' };
const ctxHome: SearchContext = { lang: 'it', course: '', notePath: '' };

describe('scopeOf', () => {
  it('tags current / same-course / other', () => {
    expect(scopeOf(entry({ id: 1, notePath: 'fisica/intro' }), ctxLecture)).toBe('current');
    expect(scopeOf(entry({ id: 2, notePath: 'fisica/altro' }), ctxLecture)).toBe('same-course');
    expect(scopeOf(entry({ id: 3, course: 'analisi', notePath: 'analisi/x' }), ctxLecture)).toBe('other');
  });
  it('on the home context nothing is current/same-course', () => {
    expect(scopeOf(entry({ id: 1, notePath: 'fisica/intro' }), ctxHome)).toBe('other');
  });
});

describe('buildUrl', () => {
  it('language-prefixes and appends the anchor', () => {
    expect(buildUrl(entry({ id: 1, notePath: 'fisica/intro', anchor: 'calore' }), 'it')).toBe('/it/fisica/intro#calore');
  });
  it('omits the hash for file/intro entries', () => {
    expect(buildUrl(entry({ id: 1, notePath: 'fisica/intro', anchor: '' }), 'en')).toBe('/en/fisica/intro');
  });
  it('falls back to it when lang is empty', () => {
    expect(buildUrl(entry({ id: 1, notePath: 'x', anchor: '' }), '')).toBe('/it/x');
  });
});

describe('rerank ordering', () => {
  it('current beats same-course beats other at equal raw score', () => {
    const hits = [
      hit(entry({ id: 1, course: 'analisi', notePath: 'analisi/a' }), 0.3),
      hit(entry({ id: 2, course: 'fisica', notePath: 'fisica/b' }), 0.3),
      hit(entry({ id: 3, course: 'fisica', notePath: 'fisica/intro' }), 0.3)
    ];
    const res = rerank(hits, ctxLecture);
    expect(res.map((r) => r.scope)).toEqual(['current', 'same-course', 'other']);
  });

  it('a strong out-of-context match can outrank a weak current match', () => {
    const hits = [
      hit(entry({ id: 1, kind: 'file', course: 'analisi', notePath: 'analisi/termo', noteTitle: 'Termodinamica' }), 0.02),
      hit(entry({ id: 2, notePath: 'fisica/intro' }), 0.5)
    ];
    const res = rerank(hits, ctxLecture);
    expect(res[0].noteTitle).toBe('Termodinamica'); // 0.02 < 0.5*0.3=0.15
    expect(res[0].scope).toBe('other');
  });

  it('a file-name hit outranks a same-note section at equal raw score', () => {
    const hits = [
      hit(entry({ id: 1, kind: 'section', notePath: 'analisi/derivate', anchor: 'x', heading: 'Caso n>1' }), 0.05),
      hit(entry({ id: 2, kind: 'file', notePath: 'analisi/derivate', anchor: '', noteTitle: 'Derivate' }), 0.05)
    ];
    const res = rerank(hits, ctxLecture);
    expect(res[0].kind).toBe('file');
    expect(res[0].noteTitle).toBe('Derivate');
  });

  it('home context applies no boost (pure raw score order)', () => {
    const hits = [
      hit(entry({ id: 1, notePath: 'fisica/intro' }), 0.4),
      hit(entry({ id: 2, course: 'analisi', notePath: 'analisi/a' }), 0.1)
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
      hit(entry({ id: 1, notePath: 'fisica/intro', anchor: 'a' }), 0.1),
      hit(entry({ id: 2, notePath: 'fisica/intro', anchor: 'b' }), 0.11),
      hit(entry({ id: 3, notePath: 'fisica/intro', anchor: 'c' }), 0.12),
      // another note: 3 sections, only 2 should survive
      hit(entry({ id: 4, course: 'analisi', notePath: 'analisi/x', anchor: 'a' }), 0.1),
      hit(entry({ id: 5, course: 'analisi', notePath: 'analisi/x', anchor: 'b' }), 0.11),
      hit(entry({ id: 6, course: 'analisi', notePath: 'analisi/x', anchor: 'c' }), 0.12)
    ];
    const res = rerank(hits, ctxLecture, 10);
    const current = res.filter((r) => r.scope === 'current');
    const otherX = res.filter((r) => r.url.includes('analisi/x'));
    expect(current.length).toBe(3);
    expect(otherX.length).toBe(2);
  });

  it('does not cap file entries', () => {
    const hits = [
      hit(entry({ id: 1, kind: 'file', course: 'analisi', notePath: 'analisi/x', anchor: '' }), 0.1),
      hit(entry({ id: 2, kind: 'section', course: 'analisi', notePath: 'analisi/x', anchor: 'a' }), 0.11),
      hit(entry({ id: 3, kind: 'section', course: 'analisi', notePath: 'analisi/x', anchor: 'b' }), 0.12),
      hit(entry({ id: 4, kind: 'section', course: 'analisi', notePath: 'analisi/x', anchor: 'c' }), 0.13)
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

  it('centres a balanced window on the matched range and isolates the hit', () => {
    const long = 'a'.repeat(200) + ' TARGET ' + 'b'.repeat(200);
    const start = 201; // 'T'
    const end = 206; //   'T' of TARGET (inclusive)
    const s = makeSnippet(entry({ id: 1, text: long }), [
      { key: 'text', value: long, indices: [[start, end]] }
    ]);
    expect(s.hit).toBe('TARGET'); // correct alignment: exact matched substring
    expect(s.before.length).toBeGreaterThan(0);
    expect(s.after.length).toBeGreaterThan(0);
    // balanced context on both sides (centred)
    expect(Math.abs(s.before.length - s.after.length)).toBeLessThan(4);
  });

  it('centres on the LONGEST matched range, not the first', () => {
    const text = 'xx ab yy abcdef zz';
    const s = makeSnippet(entry({ id: 1, text }), [
      { key: 'text', value: text, indices: [[3, 4], [9, 14]] }
    ]);
    expect(s.hit).toBe('abcdef');
  });

  it('caps the excerpt length when there is no match', () => {
    const long = 'a '.repeat(200);
    const s = makeSnippet(entry({ id: 1, text: long }));
    expect(s.hit).toBe('');
    expect(s.before).toBe('');
    expect(s.after.length).toBeLessThanOrEqual(140);
  });
});
