// src/lib/search/rerank.ts
// Pure context-aware reranking of Fuse hits. No Fuse import so it stays trivially
// testable; the worker passes in the Fuse result shape it needs.
import type { SearchEntry, SearchContext, SearchResult, ResultScope, SearchSnippet } from './types';

/** Minimal shape of a Fuse result we rely on (score: 0 best .. 1 worst). */
export interface RankInput {
  item: SearchEntry;
  score: number;
  matches?: ReadonlyArray<{
    key?: string;
    value?: string;
    indices?: ReadonlyArray<readonly [number, number]>;
  }>;
}

// Lower = better, so boosts are multipliers < 1.
const SCOPE_MULT: Record<ResultScope, number> = { current: 0.3, 'same-course': 0.6, other: 1 };
const SCOPE_RANK: Record<ResultScope, number> = { current: 0, 'same-course': 1, other: 2 };
const MAX_SECTIONS_PER_OTHER_NOTE = 2;
const SNIPPET_LEN = 140;

// Fuse scores cluster tightly (an exact title match scores ~0 for a note AND all
// its sections). Bucket adjusted scores so near-ties are treated as equal and
// resolved by intent — scope first, then a file-name hit over its sections.
const bucket = (x: number) => Math.round(x * 1000);
const kindRank = (k: 'file' | 'section') => (k === 'file' ? 0 : 1);

export function scopeOf(e: SearchEntry, ctx: SearchContext): ResultScope {
  if (ctx.notePath && e.notePath === ctx.notePath) return 'current';
  if (ctx.course && e.course === ctx.course) return 'same-course';
  return 'other';
}

export function buildUrl(e: SearchEntry, lang: string): string {
  const l = lang || 'it';
  const base = `/${l}/${e.notePath}`;
  return e.anchor ? `${base}#${e.anchor}` : base;
}

function clip(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Build a preview snippet split around the matched text. Positions the match
 * about a third in from the left (more context after than before) and fills the
 * rest with following text, so the snippet reads as plain inline text with no
 * gaps. Centres on the longest matched range from Fuse (the most significant
 * "item that caused the match"). Slices the ORIGINAL matched value by Fuse's
 * indices first, then collapses whitespace per-piece — collapsing first would
 * shift the indices. `before`/`after` carry their own ellipsis when truncated.
 */
export function makeSnippet(e: SearchEntry, matches?: RankInput['matches']): SearchSnippet {
  // Prefer a body ('text') match, then a heading match.
  const m =
    matches?.find((x) => x.key === 'text' && x.indices?.length) ??
    matches?.find((x) => x.key === 'heading' && x.indices?.length);
  const full = (m?.value as string) ?? e.text ?? '';

  // No precise match range → a plain leading excerpt (nothing to highlight).
  if (!m?.indices?.length) {
    const text = clip(full);
    return { before: '', hit: '', after: text.length > SNIPPET_LEN ? text.slice(0, SNIPPET_LEN) + '…' : text };
  }

  // Fuse indices are [start, end] inclusive; pick the longest matched range.
  const [start, end] = m.indices.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  const hitLen = end + 1 - start;
  const bStart = Math.max(0, start - Math.floor(SNIPPET_LEN / 3)); // match ~1/3 in
  const aEnd = Math.min(full.length, end + 1 + Math.max(0, SNIPPET_LEN - (start - bStart) - hitLen));

  let before = clip(full.slice(bStart, start));
  const hit = clip(full.slice(start, end + 1));
  let after = clip(full.slice(end + 1, aEnd));
  if (bStart > 0) before = '…' + before;
  if (aEnd < full.length) after = after + '…';
  return { before, hit, after };
}

/**
 * Rerank Fuse hits by current-location context, dedupe, and project to results.
 *
 * Boost: current note (×0.3) ≪ same course (×0.6) ≪ elsewhere (×1). On the
 * language home (no course, no note) nothing is boosted. The current note is
 * never capped (it may surface several matches); every other note contributes
 * at most two section results so one note can't flood the list.
 */
export function rerank(hits: RankInput[], context: SearchContext, limit = 10): SearchResult[] {
  const ranked = hits.map((h) => {
    const scope = scopeOf(h.item, context);
    return { h, scope, adj: h.score * SCOPE_MULT[scope] };
  });

  ranked.sort(
    (a, b) =>
      bucket(a.adj) - bucket(b.adj) ||
      SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope] ||
      kindRank(a.h.item.kind) - kindRank(b.h.item.kind) ||
      a.h.score - b.h.score ||
      a.h.item.id - b.h.item.id
  );

  const out: SearchResult[] = [];
  const otherSectionCount = new Map<string, number>();

  for (const r of ranked) {
    if (out.length >= limit) break;
    const e = r.h.item;
    if (r.scope !== 'current' && e.kind === 'section') {
      const c = otherSectionCount.get(e.notePath) ?? 0;
      if (c >= MAX_SECTIONS_PER_OTHER_NOTE) continue;
      otherSectionCount.set(e.notePath, c + 1);
    }
    out.push({
      kind: e.kind,
      scope: r.scope,
      noteTitle: e.noteTitle,
      courseTitle: e.courseTitle,
      heading: e.heading,
      url: buildUrl(e, context.lang),
      snippet: makeSnippet(e, r.h.matches)
    });
  }
  return out;
}
