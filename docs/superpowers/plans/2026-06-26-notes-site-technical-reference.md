# Notes Site — Technical Reference

Grounded, current (2025/2026) code backing the implementation plan
([2026-06-26-notes-site-app.md](2026-06-26-notes-site-app.md)). Produced from a
5-area research pass and consolidated. The plan's tasks cite sections here by
name instead of duplicating long code blocks.

## Cross-cutting decisions (apply everywhere)

1. **Theme attribute: `html[data-theme="dark"]`** on `document.documentElement`.
   The inline bootstrap script, theme store, Shiki CSS, KaTeX CSS, and Mermaid
   `theme` prop all key off this single attribute.
2. **KaTeX pinned `katex@^0.16.x`** (e.g. `0.16.22`). `rehype-katex@7` peers the
   0.16 line; do **not** use 0.17 (glyph-metric mismatch).
3. **Shiki via `@shikijs/rehype@4.x`** (default export `rehypeShiki`) — *not*
   `rehype-shiki`. `defaultColor: false` so tokens carry
   `--shiki-light`/`--shiki-dark`; switch via CSS.
4. **Read the sibling `../it` folder with Node `fs` + absolute paths at build
   time.** `import.meta.glob` cannot escape the project root. Use the
   `virtual:vault` Vite plugin for the tree/assets.
5. **Copy assets into `static/`, never `this.emitFile`** from load/SSR context
   (SvelteKit kit#5346 — emitted assets 404 under adapter-static). Hash
   filenames yourself.
6. **CRLF normalization.** Obsidian on Windows writes `\r\n`. Normalize
   (`raw.replace(/\r\n/g, '\n')`) before any fence/frontmatter regex; convert
   `\` → `/` when deriving URL slugs.
7. **FOUC fix = synchronous inline script in `app.html`** (no server at runtime).
8. **Theme palette comes from the spec / specy.app**, not the generic colors a
   research agent used: dark `background #171A21`, `accent #a65ee0`; light
   `background #fafafa`, `accent #da0363`; plus `secondary`, `tertiary`,
   `accent2`, `hint`, `warn`, `success`, `footer`, `shadow-color` and derived
   `*-text` colors. We keep the FOUC-safe `data-theme` mechanism (an improvement
   over specy.app's mount-time `ThemeProvider`) but use these values.

## Package set

```
# runtime / build
@sveltejs/kit@^2  @sveltejs/adapter-static@^3  svelte@^5
@sveltejs/vite-plugin-svelte@^5  vite@^8
# markdown pipeline (ESM-only)
unified@11  remark-parse@11  remark-gfm@4  remark-math@6  remark-rehype@11
rehype-raw@7  rehype-katex@7  katex@^0.16.22  rehype-slug@6
rehype-autolink-headings@7  @shikijs/rehype@4  rehype-stringify@10
unist-util-visit@5  mdast-util-to-string@4
# content + misc
gray-matter@4  reading-time@1.5  mermaid@11
# excalidraw export (build-time only)
lz-string@1.5  playwright@1.61   # npx playwright install chromium
# dev
vitest  @types/mdast  @types/hast
```

## A. `svelte.config.js` — full SSG, root base

```js
// app/svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build', assets: 'build',
      fallback: undefined, precompress: false, strict: true
    }),
    paths: { base: '' },
    prerender: { entries: ['*'], handleHttpError: 'warn', handleMissingId: 'warn' }
  }
};
export default config;
```

`app/src/routes/+layout.ts` is the single prerender switch:
```ts
export const prerender = true;
```

## B. `vite.config.js` — allow the sibling folder

```js
// app/vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vaultPlugin } from './vite-plugin-vault.js';

const VAULT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'it');

export default defineConfig({
  plugins: [vaultPlugin(), sveltekit()],
  server: { fs: { allow: ['..', VAULT_DIR] } }
});
```

## C. Root `/` → `/it` static redirect

```ts
// app/src/routes/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
export const prerender = true;
export const load: PageLoad = () => { redirect(308, '/it'); };
// redirect() during prerender emits a static meta-refresh page automatically.
```

## D. Catch-all route with `entries()`

```ts
// app/src/routes/[lang]/[...path]/+page.server.ts
import type { EntryGenerator, PageServerLoad } from './$types';
import { getNodeByPath, listAllRoutes, renderNode } from '$lib/content';

export const prerender = true;

// entries() is the ONLY way the prerenderer discovers dynamic paths.
// Rest param `path` is a SINGLE STRING with slashes; '' = the /[lang] root.
export const entries: EntryGenerator = async () =>
  (await listAllRoutes()).map((r) => ({ lang: r.lang, path: r.path }));

export const load: PageServerLoad = async ({ params }) =>
  renderNode(params.lang, params.path); // returns folder-page or note-page data
```

Gotchas: `entries()` may be async and must be exhaustive (with `strict:true` a
missing path fails the build). Use `+page.server.ts` (not `.ts`) so `node:fs`
is available; for SSG it runs only at build.

## E. Markdown pipeline

```ts
// app/src/lib/content/markdown.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import remarkObsidianLinks from './remarkObsidianLinks.js';
import remarkCallouts from './remarkCallouts.js';

export function createProcessor(resolve) {
  // `resolve` = { note(target):string, asset(target):string } link resolvers
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkObsidianLinks, resolve)   // [[x]] / ![[x]] BEFORE remark-rehype
    .use(remarkCallouts)                  // > [!type] BEFORE remark-rehype
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeShiki, {
      themes: { light: 'github-light', dark: 'github-dark' },
      fallbackLanguage: 'text', defaultColor: false
    })
    .use(rehypeStringify, { allowDangerousHtml: true });
}

export async function renderMarkdown(md, resolve) {
  return String(await createProcessor(resolve).process(md));
}
```

Order is load-bearing: `remark-math` before `remark-rehype`; `rehype-katex`
after; `rehype-slug` before autolink. Everything is ESM-only and async. Mermaid
blocks stay as fenced code (hydrated client-side; see section J).

## F. remark plugin — wikilinks + embeds

```ts
// app/src/lib/content/remarkObsidianLinks.ts
import { visit } from 'unist-util-visit';
const WIKILINK = /(!)?\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

export default function remarkObsidianLinks(resolve) {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('[[')) return;
      WIKILINK.lastIndex = 0;
      const out = []; let last = 0; let m;
      while ((m = WIKILINK.exec(node.value)) !== null) {
        const [full, bang, target, alias] = m;
        if (m.index > last) out.push({ type: 'text', value: node.value.slice(last, m.index) });
        if (bang) {
          out.push({ type: 'image', url: resolve.asset(target.trim()),
                     alt: (alias ?? target).trim(), title: null });
        } else {
          out.push({ type: 'link', url: resolve.note(target.trim()), title: null,
                     children: [{ type: 'text', value: (alias ?? target).trim() }] });
        }
        last = m.index + full.length;
      }
      if (last < node.value.length) out.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...out);
      return index + out.length; // skip inserted nodes
    });
  };
}
```

## G. remark plugin — Obsidian callouts

```ts
// app/src/lib/content/remarkCallouts.ts
import { visit } from 'unist-util-visit';
const CALLOUT = /^\[!(\w+)\]([+-]?)\s*(.*)$/;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function remarkCallouts() {
  return (tree) => {
    visit(tree, 'blockquote', (node) => {
      const first = node.children[0];
      if (first?.type !== 'paragraph') return;
      const t = first.children[0];
      if (t?.type !== 'text') return;
      const lines = t.value.split('\n');
      const match = CALLOUT.exec(lines[0]);
      if (!match) return;
      const [, rawType, fold, title] = match;
      const type = rawType.toLowerCase();
      const rest = lines.slice(1).join('\n');
      if (rest) t.value = rest; else first.children.shift();
      if (first.children.length === 0) node.children.shift();
      node.children.unshift({
        type: 'paragraph',
        data: { hName: 'div', hProperties: { className: ['callout-title'] } },
        children: [{ type: 'text', value: title || cap(type) }]
      });
      node.data = { hName: 'div', hProperties: {
        className: ['callout', `callout-${type}`], 'data-callout': type,
        ...(fold ? { 'data-callout-fold': fold === '-' ? 'closed' : 'open' } : {})
      } };
    });
  };
}
```

Strategy: rewrite Obsidian syntax into **standard** mdast nodes (link/image) and
mutate blockquotes via `data.hName`/`data.hProperties`. Don't invent node types.

## H. Vault Vite plugin (`virtual:vault`) + asset copy

```js
// app/vite-plugin-vault.js
import { readdir, readFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter'; // CJS -> default import

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = path.resolve(__dirname, '..', 'it');
const VID = 'virtual:vault';
const RESOLVED = '\0' + VID;
const STATIC_ASSETS = path.resolve(__dirname, 'static/vault-assets');
const PUBLIC_BASE = '/vault-assets';

async function walkMd(dir, root = dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await walkMd(abs, root, out);
    else if (e.name.toLowerCase().endsWith('.md'))
      out.push({ absPath: abs, relPath: path.relative(root, abs).split(path.sep).join('/') });
  }
  return out;
}

export async function copyAsset(absSrc) {
  const buf = await readFile(absSrc);
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const ext = path.extname(absSrc);
  const fileName = `${path.basename(absSrc, ext)}.${hash}${ext}`;
  await mkdir(STATIC_ASSETS, { recursive: true });
  await copyFile(absSrc, path.join(STATIC_ASSETS, fileName));
  return `${PUBLIC_BASE}/${fileName}`;
}

export function vaultPlugin() {
  return {
    name: 'vault', enforce: 'pre',
    resolveId(id) { if (id === VID) return RESOLVED; },
    async load(id) {
      if (id !== RESOLVED) return;
      if (!existsSync(VAULT_DIR)) throw new Error(`[vault] missing ${VAULT_DIR}`);
      const files = await walkMd(VAULT_DIR);
      const nodes = [];
      for (const { absPath, relPath } of files) {
        const raw = (await readFile(absPath, 'utf-8')).replace(/\r\n/g, '\n');
        const { data, content } = matter(raw);
        nodes.push({ relPath, frontmatter: data, content });
      }
      return `export const files = ${JSON.stringify(nodes)};\nexport default files;`;
    },
    configureServer(server) {
      server.watcher.add(VAULT_DIR);
      const onChange = (f) => {
        if (!f.startsWith(VAULT_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      for (const ev of ['add', 'change', 'unlink']) server.watcher.on(ev, onChange);
    }
  };
}
```

Gotchas: `server.fs.allow` must include `'..'` or dev 403s on `../it`; Vite's
watcher only watches inside root, so `server.watcher.add(VAULT_DIR)` +
`invalidateModule` + `full-reload`; `gray-matter` is CJS (default import);
`static/` files are copied verbatim, so hash names yourself; clean
`static/vault-assets` between builds.

## I. Excalidraw → SVG (build-time, Playwright)

No reliable pure-Node path (jsdom / `excalidraw-to-svg` both fail). Drive
headless Chromium and load `@excalidraw/excalidraw` from esm.sh.

```js
// app/scripts/readExcalidrawScene.mjs
import fs from 'node:fs';
import LZString from 'lz-string'; // CJS default import
export function readExcalidrawScene(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const c = raw.match(/```compressed-json\n([\s\S]*?)\n```/);
  if (c) {
    const json = LZString.decompressFromBase64(c[1].replace(/\s/g, ''));
    if (!json) throw new Error('lz-string decompress failed');
    return JSON.parse(json);
  }
  const p = raw.match(/```json\n([\s\S]*?)\n```/);
  if (p) return JSON.parse(p[1]);
  throw new Error('No Drawing fence in ' + filePath);
}
```

```js
// app/scripts/excalidrawExporter.mjs
import { chromium } from 'playwright';
const V = '0.18.1';
const BOOT_HTML = `<!DOCTYPE html><html><head>
<script type="importmap">{"imports":{
  "react":"https://esm.sh/react@19.0.0",
  "react/jsx-runtime":"https://esm.sh/react@19.0.0/jsx-runtime",
  "react-dom":"https://esm.sh/react-dom@19.0.0",
  "react-dom/client":"https://esm.sh/react-dom@19.0.0/client"
}}</script>
<script>window.EXCALIDRAW_ASSET_PATH="https://esm.sh/@excalidraw/excalidraw@${V}/dist/prod/";</script>
</head><body><script type="module">
  import * as L from 'https://esm.sh/@excalidraw/excalidraw@${V}/dist/prod/index.js?external=react,react-dom';
  window.ExcalidrawLib = L;
</script></body></html>`;

export async function makeExporter() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(BOOT_HTML, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.ExcalidrawLib?.exportToSvg', { timeout: 60000 });
  async function exportScene(scene, { dark }) {
    return page.evaluate(async ({ scene, dark }) => {
      const live = (scene.elements || []).filter((e) => !e.isDeleted);
      if (live.length === 0) return null;
      const svg = await window.ExcalidrawLib.exportToSvg({
        elements: live,
        appState: { ...scene.appState, exportBackground: true, exportWithDarkMode: dark },
        files: scene.files || {}
      });
      return new XMLSerializer().serializeToString(svg);
    }, { scene, dark });
  }
  return { exportScene, close: () => browser.close() };
}
```

Gotchas: filter `isDeleted` elements (0 live = skip, not error);
`exportWithDarkMode`/`exportBackground` are **appState** fields; reuse one
browser/page; embedded raster images live in the vault (under `## Embedded
Files`), not `scene.files` — inject them as dataURLs if needed; esm.sh needs
build-time network (cache Chromium in CI). Any failure → return `null` →
caller renders a placeholder; build never crashes.

## J. Client bits — Mermaid, theme, FOUC, reading-time

```svelte
<!-- app/src/lib/components/Mermaid.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import mermaid from 'mermaid';
  let { code, theme = 'default' } = $props();
  let svg = $state(''); let error = $state<string | null>(null);
  const base = `mmd-${Math.random().toString(36).slice(2)}`; let n = 0;
  $effect(() => {
    const _c = code, _t = theme; if (!browser || !_c) return;
    let cancelled = false;
    (async () => {
      try {
        error = null;
        mermaid.initialize({ startOnLoad: false, theme: _t, securityLevel: 'loose' });
        const { svg: out } = await mermaid.render(`${base}-${n++}`, _c);
        if (!cancelled) svg = out;
      } catch (e) { if (!cancelled) error = e instanceof Error ? e.message : String(e); }
    })();
    return () => { cancelled = true; };
  });
</script>
{#if error}<pre class="mermaid-error">{error}</pre>
{:else}<div class="mermaid">{@html svg}</div>{/if}
```

```html
<!-- app/src/app.html — synchronous FOUC-free theme bootstrap -->
<script>
  (function () {
    try {
      var stored = localStorage.getItem('theme');
      var prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', stored || (prefersDark ? 'dark' : 'light'));
    } catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }
  })();
</script>
```

```ts
// app/src/lib/theme.svelte.ts — palette from the spec (specy.app)
import { browser } from '$app/environment';
type ThemeName = 'light' | 'dark';
const THEMES: Record<ThemeName, Record<string,string>> = {
  dark:  { '--background':'#171A21','--secondary':'#212630','--tertiary':'#2d3950',
           '--footer':'#1c2029','--accent':'#a65ee0','--accent2':'#38454f',
           '--hint':'#939393','--warn':'#ed4f4f','--success':'#356a59' },
  light: { '--background':'#fafafa','--secondary':'#f6f6f6','--tertiary':'#2d3950',
           '--footer':'#212121','--accent':'#da0363','--accent2':'#38454f',
           '--hint':'#939393','--warn':'#ed4f4f','--success':'#356a59' }
};
function initial(): ThemeName {
  if (!browser) return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
export const themeState = $state<{ name: ThemeName }>({ name: initial() });
export function applyTheme(name: ThemeName) {
  themeState.name = name; if (!browser) return;
  const r = document.documentElement;
  r.setAttribute('data-theme', name);
  for (const [k, v] of Object.entries(THEMES[name])) r.style.setProperty(k, v);
  localStorage.setItem('theme', name);
}
export function toggleTheme() { applyTheme(themeState.name === 'dark' ? 'light' : 'dark'); }
export function hydrateTheme() { applyTheme(initial()); }
```

```css
/* app/src/app.css — Shiki + KaTeX flip on data-theme */
.shiki, .shiki span { color: var(--shiki-light); background: var(--shiki-light-bg); }
html[data-theme='dark'] .shiki, html[data-theme='dark'] .shiki span {
  color: var(--shiki-dark) !important; background: var(--shiki-dark-bg) !important;
}
html[data-theme='dark'] .shiki span {
  font-style: var(--shiki-dark-font-style); font-weight: var(--shiki-dark-font-weight);
}
.katex { color: var(--background-text); }
.callout { border-left: 4px solid var(--accent); padding: .5rem 1rem; border-radius: 4px; }
.callout-title { font-weight: 600; }
```

KaTeX CSS: `import 'katex/dist/katex.min.css'` once in root `+layout.svelte`
(so Vite fingerprints the `KaTeX_*.woff2` fonts).

```ts
// reading-time at build time — note v1.5 returns a FLAT words:number
import readingTime from 'reading-time';
const stats = readingTime(plainText); // { text, minutes, words }
```

## Build order

1. (prebuild) Excalidraw export → `*.light.svg`/`*.dark.svg` into the asset dir.
2. `vite build` runs `vaultPlugin` → `virtual:vault` manifest from `../it`,
   copies referenced assets into `static/vault-assets/`.
3. SvelteKit prerenders: `entries()` enumerates nodes, `load()` returns
   folder/note data, `renderMarkdown()` bakes HTML into static pages,
   `reading-time` computed at build.
4. Client hydrates: inline script set `data-theme`; layout imports KaTeX CSS +
   applies palette vars; Mermaid renders client-side; Shiki/KaTeX flip via
   `html[data-theme="dark"]`.
