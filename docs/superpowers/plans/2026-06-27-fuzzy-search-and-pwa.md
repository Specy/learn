# Fuzzy Search + PWA/Offline — Implementation Plan

> Spec: `docs/superpowers/specs/2026-06-27-fuzzy-search-and-pwa-design.md`

**Goal:** Context-aware "search everywhere" (Fuse.js in a Web Worker, build-time
lz-compressed index) + PWA install + network-first offline.

**Tech:** SvelteKit 2 / Svelte 5 runes, adapter-static, Vite plugin, Web Worker,
service worker, fuse.js, lz-string, github-slugger.

## Global Constraints
- All worker/search/SW code is client-only (`browser` guard / `onMount`).
- URL paths use prefix-stripped slugs; section anchors must equal `rehype-slug`
  (github-slugger) output.
- Index emitted at `/search-index.json` (lz `compressToBase64`), no committed file.
- Max 10 results; debounce 120ms; cap 2 sections/non-current note.
- Don't precache build/prerendered in the SW; runtime network-first only.
- Don't break SSR/prerender (`strict:true`).

---

## Phase A — Search

### Task A0: Dependencies
- `npm i fuse.js` ; `npm i -D github-slugger`.
- Verify `npm run check` / existing `npm test` still pass.

### Task A1: Pure index builder — `scripts/searchIndex.mjs`
**Files:** Create `scripts/searchIndex.mjs`, `scripts/searchIndex.test.mjs`.
**Produces:** `buildSearchIndex(files) => SearchEntry[]`, plus `stripPrefix`,
`mdToText`, `splitSections`.
- `splitSections(md)`: returns leading intro `{heading:null, anchor:'', text}` then
  one per `##`/`###`/`####` heading `{heading, anchor, text}`; anchors via a fresh
  `GithubSlugger` per note (so duplicate headings get `-1` suffixes like rehype).
- `buildSearchIndex`: for each file, strip frontmatter is already done (files carry
  `frontmatter` + `content`); skip `index.md` as a note but record course titles;
  emit one `kind:'file'` entry (title/desc/intro text) + one `kind:'section'` entry
  per heading. `course`=first url segment, `courseTitle`=course `index.md` title,
  `notePath`=stripped url path, ids sequential.
- **Tests:** anchors match known github-slugger output (incl. duplicate headings &
  accented Italian headings); intro section present; file+section kinds; course/
  courseTitle/notePath derivation; `index.md` not emitted as its own note;
  plaintext strips code/math/markup.

### Task A2: Types — `src/lib/search/types.ts`
**Files:** Create. **Produces:** `SearchEntry`, `SearchEntryKind`, `SearchResult`,
`ResultScope`, `SearchContext`, worker message types. Consumed by A3–A6.

### Task A3: Rerank — `src/lib/search/rerank.ts`
**Files:** Create `rerank.ts`, `rerank.test.ts`.
**Consumes:** types. **Produces:** `rerank(hits, context, limit) => SearchResult[]`
where `hits = { item: SearchEntry, score: number, matches? }[]` (Fuse shape).
- Scope from context; score multipliers current `0.3` / same-course `0.6` / other `1`.
- Homepage context → no boost, scope `other`.
- Dedup: ≤2 sections per non-current note; current note uncapped.
- `url = /{lang}/{notePath}` + (`anchor` ? `#anchor` : ''); snippet builder.
- **Tests:** ordering (current beats same-course beats other at equal raw score);
  scope tags; dedup cap respected; current-file multiple allowed; kind preserved;
  url with/without anchor; homepage = no boost.

### Task A4: Vite plugin — `vite-plugin-search-index.js`
**Files:** Create plugin; modify `vite.config.js` (add to plugins).
**Consumes:** `buildSearchIndex` (A1), `walkMd` (reuse from `vite-plugin-vault.js`),
gray-matter, lz-string.
- Build `files` from vault (same parse as vault plugin), `buildSearchIndex`, compress.
- dev middleware serves `/search-index.json`; invalidate cache on vault changes.
- `generateBundle` emits the asset.
- **Verify:** `npm run dev` then `curl /search-index.json` returns non-empty;
  `npm run build` produces `build/search-index.json`.

### Task A5: Worker — `src/lib/search/searchWorker.ts`
**Files:** Create. **Consumes:** types, `rerank`, fuse.js, lz-string.
- `sync`: fetch+decompress+parse+build Fuse (weighted keys per spec), warm.
- `search`: filter by lang, Fuse query, `rerank`, reply.
- RPC by `id`; error replies.

### Task A6: Client — `src/lib/search/searchClient.svelte.ts`
**Files:** Create. **Consumes:** worker, types.
- Singleton, `$state` status/searching, `sync()`, `search()`, RPC map, `browser`
  guard, main-thread fallback when no `Worker`.

### Task A7: Icons + Search UI
**Files:** Modify `Icon.svelte` (add `search`,`file`,`hash`); create
`SearchModal.svelte`; modify `+layout.svelte` (button right of menu-toggle, mount
modal, Ctrl/Cmd+K); modify `i18n/it.json`+`en.json` (search strings).
- Palette UI, debounce, max 10, keyboard nav, `goto`, spinner states, scope chips,
  two row visuals, context from `page`.
- **Verify:** dev — open with button + Cmd/K; type; results rerank by location;
  chips correct; file vs section rows; jump to anchor works.

---

## Phase B — PWA / Offline

### Task B1: Manifest + head
**Files:** Create `static/manifest.webmanifest`; modify `app.html`.
- Verify favicon/logo dimensions; reference best icons (192/512, maskable).

### Task B2: Offline route
**Files:** Create `src/routes/offline/+page.svelte` (+ prerender); i18n strings.

### Task B3: Service worker
**Files:** Create `src/service-worker.ts`.
- Precache only `/offline`; activate cleanup by `version`; network-first runtime
  cache; navigation fallback to `/offline`.
- **Verify:** `npm run build && npm run preview`; install prompt; visit pages
  online then go offline → visited pages load, unvisited → offline page; search
  works offline after one sync.

---

## Final verification
- `npm test` (vitest) green; `npm run check` clean; `npm run build` succeeds with
  all routes prerendered; manual prod-preview offline + search pass.
- Adversarial review of the diff.
