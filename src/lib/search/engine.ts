// src/lib/search/engine.ts
// Fuse setup + query logic, shared by the Web Worker and the main-thread
// fallback so there is a single source of truth for search behaviour.
import Fuse from 'fuse.js';
import { rerank, type RankInput } from './rerank';
import type { SearchEntry, SearchContext, SearchResult } from './types';

export const FUSE_OPTIONS: import('fuse.js').IFuseOptions<SearchEntry> = {
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  useExtendedSearch: true, // space-separated tokens = AND of fuzzy matches
  threshold: 0.4,
  minMatchCharLength: 2,
  keys: [
    { name: 'noteTitle', weight: 3 },
    { name: 'heading', weight: 2 },
    { name: 'text', weight: 1 }
  ]
};

/** Inflate the gzip `/search-index.bin` response to the entry array. */
export async function inflateIndex(res: Response): Promise<SearchEntry[]> {
  if (!res.ok) throw new Error(`search index fetch -> ${res.status}`);
  if (typeof DecompressionStream === 'undefined' || !res.body) {
    throw new Error('DecompressionStream unsupported');
  }
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text) as SearchEntry[];
}

export function buildFuse(entries: SearchEntry[]): Fuse<SearchEntry> {
  return new Fuse(entries, FUSE_OPTIONS);
}

/** Build an extended-search pattern: each whitespace token fuzzy-AND-matched. */
export function toPattern(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[!^'=|]+/, '')) // drop leading extended-search operators
    .filter(Boolean)
    .join(' ');
}

export function runSearch(
  fuse: Fuse<SearchEntry>,
  query: string,
  context: SearchContext,
  limit: number
): SearchResult[] {
  const pattern = toPattern(query);
  if (!pattern) return [];
  // No Fuse limit: context reranking (esp. the current-lecture boost) must see
  // every match, or a current-page hit with a slightly worse raw score than N
  // matches elsewhere would be cut before it can be boosted. rerank caps output.
  const hits = fuse.search(pattern);
  const inputs: RankInput[] = hits.map((h) => ({
    item: h.item,
    score: h.score ?? 1,
    matches: h.matches as RankInput['matches']
  }));
  return rerank(inputs, context, limit);
}
