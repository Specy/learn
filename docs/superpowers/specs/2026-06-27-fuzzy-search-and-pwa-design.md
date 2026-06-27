# Fuzzy Search + PWA/Offline — Design

**Date:** 2026-06-27
**Status:** Approved
**Repo:** `Specy/learn` (the SvelteKit app)

## Goal

Add a single "search everywhere" to the site: Fuse.js fuzzy search with
context-aware reranking, running off the main thread in a Web Worker, fed by a
build-time compressed index. Plus PWA install and a network-first offline
experience.

## Architecture overview

```
build:  vault .md ──► searchIndex.mjs ──► entries[] ──► lz-string ──► /search-index.json
                         (vite-plugin-search-index.js: dev middleware + build emit)

run:    main thread ──postMessage──► Web Worker (Fuse + lz decompress + rerank)
            │  sync()  → fetch /search-index.json, decompress, build Fuse (warm in memory)
            │  search(query, context) → Fuse → rerank by context → top 10
            ▼
        SearchModal (palette UI)

pwa:    service-worker.ts — network-first runtime cache + /offline fallback
        manifest.webmanifest + theme-color
```

The search Web Worker and the PWA service worker are independent. The only
interaction: the worker's `fetch('/search-index.json')` is intercepted by the
service worker and cached (network-first), giving offline search after one sync.

## Content facts this builds on

- SvelteKit 2 + Svelte 5 runes, `@sveltejs/adapter-static`, full prerender,
  `strict: true`, no SPA fallback.
- Content exposed by `virtual:vault` as `files: { relPath, frontmatter, content }[]`.
- Routes: `/[lang]/[...path]`. URL path = prefix-stripped slugs (`NN-slug`→`slug`,
  see `src/lib/content/slug.ts`).
- Headings already get slug ids via `rehype-slug` (which uses `github-slugger`).
- `lz-string` already installed. `fuse.js` is not.
- Menu-toggle button lives in `src/routes/+layout.svelte` (fixed top-left).
- Color tokens: `--accent` #a65ee0, `--accent2` #38454f, `--tertiary` #2d3950,
  `--secondary` #212630, `--background` #171A21.

## 1. Build-time index

### `scripts/searchIndex.mjs` (pure, testable)
Plain ESM (like `scripts/buildExcalidraw.mjs`). Exports:
- `stripPrefix(name)` — `NN-slug` → `slug` (mirrors `parseEntryName`).
- `mdToText(md)` — markdown → plain text (mirrors `src/lib/content/plainText.ts`).
- `splitSections(md)` — split body into `{ heading, anchor, text }[]` at h2–h4,
  with a leading intro section (`heading: null, anchor: ''`). Anchors via
  `github-slugger` so they equal what `rehype-slug` emits on the page.
- `buildSearchIndex(files)` — returns `SearchEntry[]` (see model). Derives
  `course`/`courseTitle` from each note's top-level folder + its `index.md`
  title; derives `notePath` (url path) from the prefix-stripped relPath.

### `vite-plugin-search-index.js`
- `buildStart`: build entries, `source = LZString.compressToBase64(JSON.stringify(entries))`.
- dev (`configureServer`): serve `GET /search-index.json` → `source`; invalidate
  on vault file add/change/unlink (same watcher pattern as `vite-plugin-vault.js`).
- build (`generateBundle`): `this.emitFile({ type:'asset', fileName:'search-index.json', source })`.
- Registered in `vite.config.js` plugins array.

Result: `/search-index.json` is a fetchable, cacheable resource in both dev and
prod. No committed file.

## 2. Data model (`src/lib/search/types.ts`)

```ts
type SearchEntryKind = 'file' | 'section';
interface SearchEntry {
  id: number;
  kind: SearchEntryKind;
  lang: string;            // 'it' (en later)
  course: string;          // top-level slug, '' for root-level pages
  courseTitle: string;     // display name
  notePath: string;        // url path, e.g. 'fisica/intro'
  noteTitle: string;
  heading: string | null;  // section heading text (null for file/intro)
  anchor: string;          // '' for file/intro, slug for sections
  text: string;            // searchable body (snippet source)
}
type ResultScope = 'current' | 'same-course' | 'other';
interface SearchResult {
  kind: SearchEntryKind;
  scope: ResultScope;
  lang: string;
  noteTitle: string;
  courseTitle: string;
  heading: string | null;
  url: string;             // /{lang}/{notePath}{#anchor}
  snippet: string;
}
```

- **file entry** (one per note): Fuse keys weight `noteTitle` highest, plus slug
  words, `description`, and intro text. `anchor:''` (jump to top).
- **section entry** (one per h2–h4): keys `heading` (high), `text` (low),
  `noteTitle` (low). `anchor:<slug>` (jump to `#anchor`).

## 3. Search Web Worker (`src/lib/search/searchWorker.ts`)

Module worker. Message protocol (RPC by `id`):
- `{ id, type:'sync', url }` → fetch url → `decompressFromBase64` → `JSON.parse`
  → build one `Fuse` (`includeScore`, `includeMatches`, `ignoreLocation:true`,
  `minMatchCharLength:2`, threshold ~0.4, weighted keys). Keep index + entries
  warm in memory. Reply `{ id, ok:true }`.
- `{ id, type:'search', query, context:{ lang, course, notePath }, limit }` →
  Fuse search (filtered to `context.lang`) → `rerank(hits, context, limit)` →
  reply `{ id, ok:true, result: SearchResult[] }`.
- Errors reply `{ id, ok:false, error }`.

### `src/lib/search/rerank.ts` (pure, the core correctness gate)
`rerank(hits, context, limit) => SearchResult[]`:
- Adjust each hit's Fuse score by scope: current note `*0.3`, same course
  `*0.6`, other `*1.0` (lower = better). Homepage context (`!course && !notePath`)
  → no boost, all `scope:'other'`.
- Tag `scope`. Dedup: at most 2 section results per non-current note; the
  **current file may contribute multiple** results. file entries are never
  capped against their own sections.
- Sort by adjusted score asc, take `limit`.
- Build `url` and `snippet` (window around first match index if available, else
  first ~140 chars of `text`).

## 4. Main-thread client (`src/lib/search/searchClient.svelte.ts`)

Singleton:
- Lazily spawns the worker (`new Worker(new URL('./searchWorker.ts', import.meta.url), { type:'module' })`).
- `$state` `status: 'idle'|'syncing'|'ready'|'error'`, `searching: boolean`.
- `sync()` (called on first modal open / app mount): posts `sync` with
  `${base}/search-index.json`; sets status.
- `search(query, ctx): Promise<SearchResult[]>`: if not ready, awaits sync;
  sets `searching` around the call. RPC via a `Map<id, {resolve,reject}>`.
- Guarded by `browser`. If `Worker` is unavailable, fall back to a lazy
  main-thread import of fuse.js + lz-string using the same `rerank`.

## 5. UI

- `Icon.svelte`: add `search`, `file`, `hash` glyphs (feather style).
- `+layout.svelte`: **search button immediately right of `.menu-toggle`**, always
  rendered (independent of load state). Opens `SearchModal`. `Ctrl/Cmd+K` toggles.
- `SearchModal.svelte`:
  - Backdrop + centered wide palette; autofocused input; debounce 120ms.
  - Scrollable results, **max 10**. Keyboard ↑/↓/Enter/Esc; click to go.
  - Navigate with `goto(url)`; close on navigate; same-page anchors scroll.
  - **Spinner** when `status==='syncing'` after the user has typed, or while
    `searching`. Empty-query and no-results states.
  - Context from `page`: `lang=seg[0]`, `course=seg[1]`, `notePath=seg.slice(1).join('/')`.
    On `/[lang]` (no course/note) → no priority.

### Result row rendering
| Match | Visual | Lands on |
|---|---|---|
| `kind:'file'` | file icon + bold note title | top of file |
| `kind:'section'` | hash icon + `Note › Heading` + snippet | `#anchor` |

Scope chip (right):
- `current` → `--accent` background.
- `same-course` → `--accent2` background.
- `other` → neutral (`--tertiary`/`--secondary`) chip showing the **course title**.

## 6. PWA / Offline

- `static/manifest.webmanifest`: `display:standalone`, `theme_color:#171A21`,
  `background_color:#171A21`, `start_url:/`, name/short_name, icons from existing
  `favicon.png`/`logo.png` (verify sizes; refine if needed). `<link rel="manifest">`
  + `<meta name="theme-color">` in `app.html`.
- `src/service-worker.ts` (SvelteKit auto-registers in prod; inactive in dev):
  - **No full precache** (explicit requirement). `install` precaches only the
    `/offline` fallback page; `skipWaiting`.
  - `activate`: claim clients, delete caches not matching the current `version`.
  - `fetch` (GET, same-origin): **network-first** — try network, on success put a
    clone in the runtime cache and return; on failure return cached; if the
    request is a navigation with no cache, return the precached `/offline` page.
  - The `/search-index.json` fetch goes through this handler → cached → offline
    search works after one online sync.
- `src/routes/offline/+page.svelte` (prerendered): "This page hasn't been loaded
  yet — reconnect to view it." i18n via existing dictionaries.

## 7. Dependencies

- Add `fuse.js` (dependency).
- Add `github-slugger` (devDependency — build-time only).
- `lz-string` already present (imported in worker + plugin).

## 8. Error handling / edge cases

- Index fetch fails → `status:'error'`; button still opens, modal shows
  "search unavailable".
- `Worker` unsupported → main-thread fallback.
- SSR/prerender: all worker/search/SW code is client-only (`browser` guards or
  `onMount`); index plugin runs at build only.
- Empty query → no results, no spinner.
- Query during sync → spinner, runs when ready.
- lang switch → context re-derived; index covers all langs.

## 9. Testing

- `scripts/searchIndex.test.mjs`: section split, anchors == github-slugger,
  course/title/url derivation, plaintext stripping, file vs section entries.
- `src/lib/search/rerank.test.ts`: boost order (current > same-course > other),
  scope tagging, dedup caps (current-file multiple allowed), kind preserved,
  url/snippet construction. Core correctness gate.
- Worker/UI/SW verified via `npm run build` + `npm run preview` (prod SW) and a
  manual offline check.

## 10. Phasing

- **Phase A — Search:** index builder + plugin, types, rerank, worker, client,
  UI. Independently shippable and the bulk of the value.
- **Phase B — PWA/Offline:** manifest, icons, service worker, offline route.

## Defaults chosen

- Index via Vite plugin (dev+build), not a prebuild script — keeps `vite dev`
  working with no extra wiring.
- `compressToBase64` (ASCII-safe fetchable body).
- Debounce 120ms; 10 results max; cap 2 sections/note except the current file.
