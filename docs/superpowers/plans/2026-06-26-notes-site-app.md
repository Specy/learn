# Notes Site App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a SvelteKit static site in `app/` that renders the Obsidian
vault as a navigable, themeable course/lecture website, validated end-to-end
against the `fisica` course.

**Architecture:** Fully prerendered SvelteKit (`adapter-static`). A custom Vite
plugin (`virtual:vault`) reads markdown from the sibling `../it` folder and
copies assets into `static/`. A build-time `unified` (remark→rehype) pipeline
renders Obsidian-flavored markdown (math, callouts, wikilinks, embeds, code) to
HTML strings baked into static pages. Theme is a FOUC-safe `data-theme` system
with the specy.app palette. Excalidraw scenes are exported to dual-theme SVG at
build time via headless Chromium.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes) / Vite 8 / adapter-static /
unified+remark+rehype / KaTeX / Shiki / Mermaid / Playwright / Vitest.

**Companion:** All large canonical code blocks live in
[2026-06-26-notes-site-technical-reference.md](2026-06-26-notes-site-technical-reference.md),
cited below as **TR §X**. Read it alongside this plan.

**Scope:** This plan builds the *app* and converts only `fisica` (the
already-structured course) as the validation fixture. Converting the other 7
courses is **Plan 2** (separate).

## Global Constraints

- **Package versions** exactly as in TR "Package set" (unified 11, remark-* 4/6/11,
  `@shikijs/rehype@4`, `rehype-katex@7` + `katex@^0.16.22` — **never 0.17**,
  `gray-matter@4`, `mermaid@11`, `lz-string@1.5`, `playwright@1.61`).
- **ESM only** across the markdown pipeline; `processor.process()` is async.
- **Theme attribute is `html[data-theme="dark"]`** everywhere (TR §J, decision 1).
- **Palette = specy.app** (TR §J `THEMES`): dark `#171A21`/accent `#a65ee0`,
  light `#fafafa`/accent `#da0363`. Never the generic research colors.
- **Served at domain root**, `paths.base = ''`.
- **Content root is the sibling `../it`** read with Node `fs` at build time;
  never `import.meta.glob` for it (TR decision 4).
- **Assets copied into `static/vault-assets/`**, hashed; never `this.emitFile`
  (TR decision 5).
- **Normalize CRLF** (`\r\n`→`\n`) before any regex; POSIX slashes in slugs
  (Windows vault) (TR decision 6).
- **Fonts:** Rubik (UI/headings), Noto Serif (body), Fira Code (code).
- **Naming contract:** folders/notes are `NN-slug`; folder descriptor is
  `index.md` (exempt); a folder is navigable iff it contains `index.md`. URLs
  strip the `NN-` prefix. (See the design spec.)
- Each task ends GREEN (`npx vitest run` for unit tasks; `npm run build` for
  integration tasks) and a commit.

---

## Task 1: Scaffold the app + static SSG + smoke build

**Files:**
- Create: `app/package.json`, `app/svelte.config.js`, `app/vite.config.js`,
  `app/tsconfig.json`, `app/vitest.config.ts`, `app/src/app.html`,
  `app/src/app.css`, `app/src/routes/+layout.ts`, `app/src/routes/+layout.svelte`,
  `app/src/routes/+page.ts`, `app/src/routes/[lang]/+page.ts`,
  `app/src/routes/[lang]/+page.svelte`, `app/.gitignore`

**Interfaces:**
- Produces: a buildable SvelteKit app; `/` redirects to `/it`; `/it` prerenders.

- [ ] **Step 1: Scaffold SvelteKit (Svelte 5 + TS) in `app/`**

```bash
cd app   # create the folder first if needed
npm create svelte@latest .   # choose: Skeleton project, TypeScript, no extras
npm i -D @sveltejs/adapter-static vitest
npm i
```

If the interactive prompt is unavailable, create `app/package.json` manually:

```json
{
  "name": "notes-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3",
    "@sveltejs/kit": "^2",
    "@sveltejs/vite-plugin-svelte": "^5",
    "svelte": "^5",
    "svelte-check": "^4",
    "typescript": "^5",
    "vite": "^8",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: Config files**

Create `app/svelte.config.js` = **TR §A** verbatim. Create `app/src/routes/+layout.ts` = **TR §A** one-liner (`export const prerender = true;`). Create `app/vite.config.js` = **TR §B** but, for this task only, comment out the `vaultPlugin()` import + usage (added in Task 7) — keep the `server.fs.allow`.

- [ ] **Step 3: app.html with FOUC bootstrap**

Create `app/src/app.html` with the standard SvelteKit shell plus the synchronous theme `<script>` from **TR §J** (before `%sveltekit.head%`), and font preconnects for Google Fonts (Rubik, Noto Serif, Fira Code).

- [ ] **Step 4: Minimal routes**

`app/src/routes/+page.ts` = **TR §C** (redirect `/`→`/it`).
`app/src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>
{@render children?.()}
```

`app/src/routes/[lang]/+page.ts`:

```ts
import type { EntryGenerator, PageLoad } from './$types';
export const prerender = true;
export const entries: EntryGenerator = () => [{ lang: 'it' }];
export const load: PageLoad = ({ params }) => ({ lang: params.lang });
```

`app/src/routes/[lang]/+page.svelte`:

```svelte
<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>
<h1>Notes — {data.lang}</h1>
```

`app/src/app.css`: empty for now (`/* global */`).

- [ ] **Step 5: .gitignore**

`app/.gitignore`:
```
node_modules
/build
/.svelte-kit
/static/vault-assets
```

- [ ] **Step 6: Build and verify**

Run: `cd app && npm run build`
Expected: build succeeds; `app/build/index.html` exists and contains
`http-equiv="refresh"` pointing at `/it`; `app/build/it.html` (or
`app/build/it/index.html`) exists containing `Notes — it`.

- [ ] **Step 7: Commit**

```bash
git add app/
git commit -m "feat(app): scaffold SvelteKit static site with /->/it redirect"
```

---

## Task 2: Entry-name parsing (`NN-slug`)

**Files:**
- Create: `app/src/lib/content/slug.ts`
- Test: `app/src/lib/content/slug.test.ts`

**Interfaces:**
- Produces: `parseEntryName(name: string): { order: number | null; slug: string }`,
  `stripMdExt(name: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/content/slug.test.ts
import { describe, it, expect } from 'vitest';
import { parseEntryName, stripMdExt } from './slug';

describe('parseEntryName', () => {
  it('splits a zero-padded numeric prefix', () => {
    expect(parseEntryName('01-introduzione')).toEqual({ order: 1, slug: 'introduzione' });
    expect(parseEntryName('12-studio-funzione')).toEqual({ order: 12, slug: 'studio-funzione' });
  });
  it('handles names without a prefix', () => {
    expect(parseEntryName('formulario')).toEqual({ order: null, slug: 'formulario' });
  });
  it('treats index specially via slug only', () => {
    expect(parseEntryName('index')).toEqual({ order: null, slug: 'index' });
  });
  it('strips the .md extension first', () => {
    expect(stripMdExt('01-intro.md')).toBe('01-intro');
    expect(stripMdExt('02-teoria')).toBe('02-teoria');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/content/slug.test.ts`
Expected: FAIL — `parseEntryName is not a function`.

- [ ] **Step 3: Implement**

```ts
// app/src/lib/content/slug.ts
const PREFIX = /^(\d+)-(.+)$/;

export function stripMdExt(name: string): string {
  return name.replace(/\.md$/i, '');
}

export function parseEntryName(name: string): { order: number | null; slug: string } {
  const m = PREFIX.exec(name);
  if (m) return { order: Number(m[1]), slug: m[2] };
  return { order: null, slug: name };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/content/slug.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/content/slug.ts app/src/lib/content/slug.test.ts
git commit -m "feat(content): parse NN-slug entry names"
```

---

## Task 3: Content types + recursive tree builder

**Files:**
- Create: `app/src/lib/content/types.ts`, `app/src/lib/content/tree.ts`
- Test: `app/src/lib/content/tree.test.ts`

**Interfaces:**
- Consumes: `parseEntryName`, `stripMdExt` (Task 2).
- Produces:
  - types `NoteType = 'lecture'|'resource'|'exercise'|'exam'|'summary'`,
    `RawFile = { relPath: string; frontmatter: Record<string, any>; content: string }`,
    `NoteNode`, `FolderNode`, `ContentNode = FolderNode | NoteNode`.
  - `buildTree(files: RawFile[]): FolderNode` (synthetic root, `slug:''`).
  - `getNodeByPath(root: FolderNode, segments: string[]): ContentNode | null`.
  - `listRoutes(root: FolderNode): { path: string }[]` (every navigable folder
    except root + every note, prefix-stripped, POSIX `/`).
  - `groupChildren(folder: FolderNode): { modules: FolderNode[]; lectures: NoteNode[]; resources: NoteNode[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/content/tree.test.ts
import { describe, it, expect } from 'vitest';
import { buildTree, getNodeByPath, listRoutes, groupChildren } from './tree';
import type { RawFile } from './types';

const files: RawFile[] = [
  { relPath: '02-fisica/index.md', frontmatter: { title: 'Fisica', description: 'Meccanica' }, content: 'overview' },
  { relPath: '02-fisica/01-intro.md', frontmatter: { title: 'Intro', description: 'd', type: 'lecture' }, content: 'a' },
  { relPath: '02-fisica/90-formulario.md', frontmatter: { title: 'Formulario', description: 'd', type: 'resource' }, content: 'b' },
  { relPath: '01-bdd/index.md', frontmatter: { title: 'Basi di Dati', description: 'd' }, content: 'o' },
  { relPath: '01-bdd/01-teoria/index.md', frontmatter: { title: 'Teoria', description: 'd' }, content: 'o' },
  { relPath: '01-bdd/01-teoria/01-intro.md', frontmatter: { title: 'T-Intro', description: 'd', type: 'lecture' }, content: 'c' },
  // an asset-only folder (NO index.md) must be ignored as a navigable node:
  { relPath: '01-bdd/attachments/note-only.md', frontmatter: {}, content: 'x' }
];

describe('buildTree', () => {
  const root = buildTree(files);

  it('orders courses by NN prefix', () => {
    expect(root.children.filter((c) => c.kind === 'folder').map((c) => c.slug))
      .toEqual(['bdd', 'fisica']);
  });

  it('strips prefixes for slugs and resolves by path', () => {
    const intro = getNodeByPath(root, ['fisica', 'intro']);
    expect(intro?.kind).toBe('note');
    expect(intro?.title).toBe('Intro');
  });

  it('treats a folder without index.md as non-navigable (asset store)', () => {
    expect(getNodeByPath(root, ['bdd', 'attachments'])).toBeNull();
  });

  it('groups children into modules / lectures / resources', () => {
    const fisica = getNodeByPath(root, ['fisica']) as any;
    const g = groupChildren(fisica);
    expect(g.modules).toEqual([]);
    expect(g.lectures.map((n: any) => n.slug)).toEqual(['intro']);
    expect(g.resources.map((n: any) => n.slug)).toEqual(['formulario']);
  });

  it('nests modules and lists every route prefix-stripped', () => {
    const paths = listRoutes(root).map((r) => r.path).sort();
    expect(paths).toContain('bdd/teoria');
    expect(paths).toContain('bdd/teoria/intro');
    expect(paths).not.toContain('bdd/attachments'); // not navigable
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/content/tree.test.ts`
Expected: FAIL — `buildTree is not a function`.

- [ ] **Step 3: Implement types**

```ts
// app/src/lib/content/types.ts
export type NoteType = 'lecture' | 'resource' | 'exercise' | 'exam' | 'summary';

export interface RawFile {
  relPath: string;                         // POSIX, e.g. '02-fisica/01-intro.md'
  frontmatter: Record<string, any>;
  content: string;
}
export interface NoteNode {
  kind: 'note';
  slug: string;                            // prefix-stripped, no ext
  path: string;                            // full url path, e.g. 'fisica/intro'
  order: number;
  title: string;
  description: string;
  type: NoteType;
  published: boolean;
  content: string;                         // raw markdown body
  frontmatter: Record<string, any>;
}
export interface FolderNode {
  kind: 'folder';
  slug: string;
  path: string;
  order: number;
  title: string;
  description: string;
  image?: string;
  published: boolean;
  content: string;                         // index.md body
  children: ContentNode[];
}
export type ContentNode = FolderNode | NoteNode;
```

- [ ] **Step 4: Implement the tree builder**

```ts
// app/src/lib/content/tree.ts
import { parseEntryName, stripMdExt } from './slug';
import type { RawFile, FolderNode, NoteNode, ContentNode, NoteType } from './types';

const BIG = Number.MAX_SAFE_INTEGER;

function emptyFolder(slug: string, path: string, order: number): FolderNode {
  return { kind: 'folder', slug, path, order, title: slug, description: '',
    published: true, content: '', children: [] };
}

export function buildTree(files: RawFile[]): FolderNode {
  const root = emptyFolder('', '', 0);

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
        next = emptyFolder(slug, urlSegs.join('/'), order ?? BIG);
        next.published = false;            // becomes true only when index.md seen
        cursor.children.push(next);
      }
      cursor = next;
    }

    if (stripMdExt(fileName) === 'index') {
      cursor.title = file.frontmatter.title ?? cursor.slug;
      cursor.description = file.frontmatter.description ?? '';
      cursor.image = file.frontmatter.image;
      cursor.order = file.frontmatter.order ?? cursor.order;
      cursor.published = file.frontmatter.published ?? true;  // navigable now
      cursor.content = file.content;
      (cursor as any)._hasIndex = true;
    } else {
      const { order, slug } = parseEntryName(stripMdExt(fileName));
      const note: NoteNode = {
        kind: 'note', slug,
        path: [...urlSegs, slug].join('/'),
        order: file.frontmatter.order ?? order ?? BIG,
        title: file.frontmatter.title ?? slug,
        description: file.frontmatter.description ?? '',
        type: (file.frontmatter.type as NoteType) ?? 'lecture',
        published: file.frontmatter.published ?? true,
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
    const navigable = (c as any)._hasIndex === true;
    if (navigable) pruneAndSort(c);
    return navigable && c.published;
  });
  folder.children.sort((a, b) => (a.order - b.order) || a.slug.localeCompare(b.slug));
}

export function getNodeByPath(root: FolderNode, segments: string[]): ContentNode | null {
  let cursor: ContentNode = root;
  for (const seg of segments) {
    if (cursor.kind !== 'folder') return null;
    const next = cursor.children.find((c) => c.slug === seg);
    if (!next) return null;
    cursor = next;
  }
  return cursor;
}

export function groupChildren(folder: FolderNode) {
  const modules = folder.children.filter((c): c is FolderNode => c.kind === 'folder');
  const notes = folder.children.filter((c): c is NoteNode => c.kind === 'note');
  return {
    modules,
    lectures: notes.filter((n) => n.type === 'lecture'),
    resources: notes.filter((n) => n.type !== 'lecture')
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/content/tree.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/content/types.ts app/src/lib/content/tree.ts app/src/lib/content/tree.test.ts
git commit -m "feat(content): recursive tree builder with type grouping + navigable rule"
```

---

## Task 4: Markdown pipeline core

**Files:**
- Create: `app/src/lib/content/markdown.ts`
- Test: `app/src/lib/content/markdown.test.ts`

**Interfaces:**
- Produces:
  - `type LinkResolver = { note(target: string): string; asset(target: string): string }`
  - `createProcessor(resolve: LinkResolver)` and
    `renderMarkdown(md: string, resolve: LinkResolver): Promise<string>`.
- Note: the two custom plugins are wired in Tasks 5 & 6; this task includes only
  the standard chain.

- [ ] **Step 1: Install deps**

```bash
cd app && npm i unified remark-parse remark-gfm remark-math remark-rehype rehype-raw rehype-katex katex@^0.16.22 rehype-slug rehype-autolink-headings @shikijs/rehype rehype-stringify unist-util-visit mdast-util-to-string
npm i -D @types/mdast @types/hast
```

- [ ] **Step 2: Write the failing test**

```ts
// app/src/lib/content/markdown.test.ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

const resolve = { note: (t: string) => `/${t}`, asset: (t: string) => `/vault-assets/${t}` };

describe('renderMarkdown', () => {
  it('renders headings with slugs', async () => {
    const html = await renderMarkdown('# Ciao Mondo', resolve);
    expect(html).toContain('id="ciao-mondo"');
  });
  it('renders inline KaTeX math', async () => {
    const html = await renderMarkdown('Sia $x^2$ il quadrato', resolve);
    expect(html).toContain('class="katex"');
  });
  it('highlights fenced code with Shiki (dual-theme vars)', async () => {
    const html = await renderMarkdown('```js\nconst a = 1;\n```', resolve);
    expect(html).toContain('class="shiki');
    expect(html).toContain('--shiki-dark');
  });
  it('renders GFM tables', async () => {
    const html = await renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |', resolve);
    expect(html).toContain('<table>');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/content/markdown.test.ts`
Expected: FAIL — cannot find module `./markdown`.

- [ ] **Step 4: Implement (standard chain only)**

Create `app/src/lib/content/markdown.ts` = **TR §E**, but for this task **omit**
the two custom plugin imports and their `.use(remarkObsidianLinks, …)` /
`.use(remarkCallouts)` lines (added in Tasks 5–6). Keep the `resolve` param so
the signature is stable.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/content/markdown.test.ts`
Expected: PASS (4 tests). (First Shiki run loads the highlighter; allow a few seconds.)

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/content/markdown.ts app/src/lib/content/markdown.test.ts app/package.json app/package-lock.json
git commit -m "feat(content): build-time markdown pipeline (gfm, katex, shiki, slug)"
```

---

## Task 5: Wikilink + embed remark plugin

**Files:**
- Create: `app/src/lib/content/remarkObsidianLinks.ts`
- Modify: `app/src/lib/content/markdown.ts` (wire the plugin in)
- Test: `app/src/lib/content/remarkObsidianLinks.test.ts`

**Interfaces:**
- Consumes: `LinkResolver` (Task 4).
- Produces: `export default function remarkObsidianLinks(resolve: LinkResolver)`.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/content/remarkObsidianLinks.test.ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';
const resolve = { note: (t: string) => `/note/${t}`, asset: (t: string) => `/vault-assets/${t}` };

describe('obsidian links', () => {
  it('turns [[Target]] into a link via resolve.note', async () => {
    const html = await renderMarkdown('vedi [[L01]] qui', resolve);
    expect(html).toContain('href="/note/L01"');
    expect(html).toContain('>L01</a>');
  });
  it('uses the alias in [[Target|Alias]]', async () => {
    const html = await renderMarkdown('[[L01|Lezione 1]]', resolve);
    expect(html).toContain('href="/note/L01"');
    expect(html).toContain('>Lezione 1</a>');
  });
  it('turns ![[img.png]] into an image via resolve.asset', async () => {
    const html = await renderMarkdown('![[Pasted image 1.png]]', resolve);
    expect(html).toContain('src="/vault-assets/Pasted image 1.png"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/content/remarkObsidianLinks.test.ts`
Expected: FAIL — `[[L01]]` passes through as literal text.

- [ ] **Step 3: Implement the plugin**

Create `app/src/lib/content/remarkObsidianLinks.ts` = **TR §F**.

- [ ] **Step 4: Wire it into the pipeline**

In `app/src/lib/content/markdown.ts`, add the import and insert
`.use(remarkObsidianLinks, resolve)` **before** `.use(remarkRehype, …)` (per TR §E).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/content/remarkObsidianLinks.test.ts`
Expected: PASS (3 tests). Re-run the full suite: `npx vitest run` — all green.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/content/remarkObsidianLinks.ts app/src/lib/content/remarkObsidianLinks.test.ts app/src/lib/content/markdown.ts
git commit -m "feat(content): resolve [[wikilinks]] and ![[embeds]]"
```

---

## Task 6: Callout remark plugin

**Files:**
- Create: `app/src/lib/content/remarkCallouts.ts`
- Modify: `app/src/lib/content/markdown.ts`
- Test: `app/src/lib/content/remarkCallouts.test.ts`

**Interfaces:**
- Produces: `export default function remarkCallouts()`.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/content/remarkCallouts.test.ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';
const resolve = { note: (t: string) => `/${t}`, asset: (t: string) => `/${t}` };

describe('callouts', () => {
  it('converts > [!info] Title into a callout div with title', async () => {
    const html = await renderMarkdown('> [!info] Nota importante\n> corpo', resolve);
    expect(html).toContain('class="callout callout-info"');
    expect(html).toContain('data-callout="info"');
    expect(html).toContain('>Nota importante<');
    expect(html).toContain('corpo');
  });
  it('defaults the title to the capitalized type when omitted', async () => {
    const html = await renderMarkdown('> [!tip]\n> x', resolve);
    expect(html).toContain('class="callout callout-tip"');
    expect(html).toContain('>Tip<');
  });
  it('leaves a normal blockquote untouched', async () => {
    const html = await renderMarkdown('> solo una citazione', resolve);
    expect(html).toContain('<blockquote>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/content/remarkCallouts.test.ts`
Expected: FAIL — output is a plain `<blockquote>` with literal `[!info]`.

- [ ] **Step 3: Implement** — create `app/src/lib/content/remarkCallouts.ts` = **TR §G**.

- [ ] **Step 4: Wire it in** — in `markdown.ts` add `.use(remarkCallouts)` after the wikilinks plugin, before `remarkRehype` (per TR §E).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run` — all suites green.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/content/remarkCallouts.ts app/src/lib/content/remarkCallouts.test.ts app/src/lib/content/markdown.ts
git commit -m "feat(content): render Obsidian callouts"
```

---

## Task 7: Vault Vite plugin + asset copy

**Files:**
- Create: `app/vite-plugin-vault.js`
- Modify: `app/vite.config.js` (enable the plugin)
- Test: `app/vite-plugin-vault.test.ts`

**Interfaces:**
- Produces: virtual module `virtual:vault` exporting
  `files: RawFile[]` and `assets: Record<string,string>` (basename → public URL);
  exported testable helpers `walkMd(dir)`, `copyAsset(absSrc, destDir)`,
  `buildManifest(vaultDir, assetDestDir)`.

- [ ] **Step 1: Install gray-matter**

```bash
cd app && npm i gray-matter
```

- [ ] **Step 2: Write the failing test (against a temp fixture)**

```ts
// app/vite-plugin-vault.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildManifest } from './vite-plugin-vault.js';

let vault: string, assetsOut: string;

beforeAll(async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'vault-'));
  vault = path.join(base, 'it'); assetsOut = path.join(base, 'out');
  await mkdir(path.join(vault, '01-fisica', 'attachments'), { recursive: true });
  await writeFile(path.join(vault, '01-fisica', 'index.md'),
    '---\ntitle: Fisica\ndescription: d\n---\noverview\n');
  await writeFile(path.join(vault, '01-fisica', '01-intro.md'),
    '---\ntitle: Intro\ndescription: d\n---\nsee ![[img.png]]\n');
  await writeFile(path.join(vault, '01-fisica', 'attachments', 'img.png'), 'PNGDATA');
});
afterAll(() => rm(path.dirname(vault), { recursive: true, force: true }));

describe('buildManifest', () => {
  it('parses frontmatter and copies assets with hashed names', async () => {
    const { files, assets } = await buildManifest(vault, assetsOut);
    const intro = files.find((f) => f.relPath === '01-fisica/01-intro.md');
    expect(intro?.frontmatter.title).toBe('Intro');
    expect(intro?.content.trim()).toBe('see ![[img.png]]');
    expect(assets['img.png']).toMatch(/^\/vault-assets\/img\.[0-9a-f]{8}\.png$/);
    const written = await readdir(assetsOut);
    expect(written.some((f) => /^img\.[0-9a-f]{8}\.png$/.test(f))).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run vite-plugin-vault.test.ts`
Expected: FAIL — `buildManifest` not exported.

- [ ] **Step 4: Implement the plugin + helpers**

Create `app/vite-plugin-vault.js` = **TR §H**, refactored so `buildManifest(vaultDir, assetDestDir)` is an exported pure function that (a) walks `.md` via `walkMd`, parses frontmatter into `files`, and (b) walks image/svg files (`.png .jpg .jpeg .gif .webp .svg`), copies each via `copyAsset` into `assetDestDir`, and returns `assets` keyed by basename. The `vaultPlugin()` export calls `buildManifest(VAULT_DIR, STATIC_ASSETS)` inside `load()` and emits both `files` and `assets`. Clean `STATIC_ASSETS` at the start of `buildManifest` so deleted images don't linger.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run vite-plugin-vault.test.ts`
Expected: PASS.

- [ ] **Step 6: Enable the plugin + add the virtual module type**

In `app/vite.config.js`, un-comment the `vaultPlugin()` import + usage (TR §B).
Add `app/src/virtual-vault.d.ts`:

```ts
declare module 'virtual:vault' {
  import type { RawFile } from '$lib/content/types';
  export const files: RawFile[];
  export const assets: Record<string, string>;
}
```

- [ ] **Step 7: Commit**

```bash
git add app/vite-plugin-vault.js app/vite-plugin-vault.test.ts app/vite.config.js app/src/virtual-vault.d.ts app/package.json app/package-lock.json
git commit -m "feat(app): virtual:vault Vite plugin with asset copy"
```

---

## Task 8: Content context (tree + resolvers + node rendering)

**Files:**
- Create: `app/src/lib/content/context.ts`, `app/src/lib/content/index.ts`,
  `app/src/lib/content/plainText.ts`
- Test: `app/src/lib/content/context.test.ts`, `app/src/lib/content/plainText.test.ts`

**Interfaces:**
- Consumes: `buildTree`, `getNodeByPath`, `groupChildren`, `listRoutes` (Task 3),
  `renderMarkdown` (Tasks 4-6), `files`/`assets` from `virtual:vault` (Task 7).
- Produces (in `context.ts`, pure + testable):
  - `buildContext(files: RawFile[], assets: Record<string,string>): Context`
  - `Context = { root: FolderNode; resolve: LinkResolver }`
  - `makeResolver(root, assets): LinkResolver` — `note(target)` finds a node by
    title or slug and returns `/<lang inserted by caller>`… (return path
    relative, the route prepends `/[lang]/`); `asset(target)` looks up
    `assets[basename]` (and `.excalidraw` handled in Task 15), else `#missing`.
  - `extractToc(html: string): { id: string; text: string; depth: number }[]`
  - `siblings(root, notePath): { prev: NoteNode|null; next: NoteNode|null }`
- Produces (in `index.ts`, consumes `virtual:vault`, NOT unit-tested):
  - `getContext(): Context` (memoized), `listAllRoutes(): {lang,path}[]`,
    `renderNode(lang, path): Promise<FolderPageData | NotePageData>`.
- Produces (in `plainText.ts`): `toPlainText(md: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/src/lib/content/plainText.test.ts
import { describe, it, expect } from 'vitest';
import { toPlainText } from './plainText';
describe('toPlainText', () => {
  it('strips code, images and markdown punctuation', () => {
    const out = toPlainText('# Title\n\n```js\nx\n```\n\n![a](b) **bold** [t](u)');
    expect(out).not.toContain('```');
    expect(out).toContain('Title');
    expect(out).toContain('bold');
    expect(out).toContain('t');           // link text kept
    expect(out).not.toContain('(u)');     // link url dropped
  });
});
```

```ts
// app/src/lib/content/context.test.ts
import { describe, it, expect } from 'vitest';
import { buildContext, extractToc, siblings } from './context';
import type { RawFile } from './types';

const files: RawFile[] = [
  { relPath: '01-fisica/index.md', frontmatter: { title: 'Fisica', description: 'd' }, content: 'o' },
  { relPath: '01-fisica/01-a.md', frontmatter: { title: 'A', description: 'd', type: 'lecture' }, content: 'x' },
  { relPath: '01-fisica/02-b.md', frontmatter: { title: 'B', description: 'd', type: 'lecture' }, content: 'y' }
];

describe('context', () => {
  it('resolves a wikilink target by title to a node path', () => {
    const { resolve } = buildContext(files, {});
    expect(resolve.note('A')).toBe('fisica/a');     // route prepends /[lang]/
  });
  it('resolves an asset by basename', () => {
    const { resolve } = buildContext(files, { 'img.png': '/vault-assets/img.1234abcd.png' });
    expect(resolve.asset('img.png')).toBe('/vault-assets/img.1234abcd.png');
  });
  it('extracts a heading ToC from rendered html', () => {
    const toc = extractToc('<h2 id="uno">Uno</h2><h3 id="due">Due</h3>');
    expect(toc).toEqual([{ id: 'uno', text: 'Uno', depth: 2 }, { id: 'due', text: 'Due', depth: 3 }]);
  });
  it('finds prev/next siblings within a folder', () => {
    const { root } = buildContext(files, {});
    const { prev, next } = siblings(root, 'fisica/b');
    expect(prev?.slug).toBe('a');
    expect(next).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/content/plainText.test.ts src/lib/content/context.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `plainText.ts`** = the `toPlainText` from **TR §J** (reading-time helper).

- [ ] **Step 4: Implement `context.ts`**

```ts
// app/src/lib/content/context.ts
import { buildTree, getNodeByPath, listRoutes } from './tree';
import type { RawFile, FolderNode, NoteNode } from './types';
import type { LinkResolver } from './markdown';

export interface Context { root: FolderNode; resolve: LinkResolver; }

function indexByTitleAndSlug(root: FolderNode) {
  const map = new Map<string, NoteNode | FolderNode>();
  const walk = (f: FolderNode) => {
    for (const c of f.children) {
      map.set(c.title.toLowerCase(), c);
      map.set(c.slug.toLowerCase(), c);
      if (c.kind === 'folder') walk(c);
    }
  };
  walk(root);
  return map;
}

export function makeResolver(root: FolderNode, assets: Record<string, string>): LinkResolver {
  const lookup = indexByTitleAndSlug(root);
  return {
    note(target: string) {
      const [name, anchor] = target.split('#');
      const hit = lookup.get(name.trim().toLowerCase());
      const base = hit ? hit.path : name.trim().toLowerCase().replace(/\s+/g, '-');
      return anchor ? `${base}#${anchor.trim().toLowerCase().replace(/\s+/g, '-')}` : base;
    },
    asset(target: string) {
      const base = target.split('/').pop()!.trim();
      return assets[base] ?? `#missing-${base}`;
    }
  };
}

export function buildContext(files: RawFile[], assets: Record<string, string>): Context {
  const root = buildTree(files);
  return { root, resolve: makeResolver(root, assets) };
}

export function extractToc(html: string) {
  const out: { id: string; text: string; depth: number }[] = [];
  const re = /<h([2-4])[^>]*\bid="([^"]+)"[^>]*>(.*?)<\/h\1>/gis;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ depth: Number(m[1]), id: m[2], text: m[3].replace(/<[^>]+>/g, '').trim() });
  }
  return out;
}

export function siblings(root: FolderNode, notePath: string) {
  const segs = notePath.split('/');
  const parent = getNodeByPath(root, segs.slice(0, -1));
  if (!parent || parent.kind !== 'folder') return { prev: null, next: null };
  const notes = parent.children.filter((c): c is NoteNode => c.kind === 'note');
  const i = notes.findIndex((n) => n.path === notePath);
  return { prev: i > 0 ? notes[i - 1] : null, next: i >= 0 && i < notes.length - 1 ? notes[i + 1] : null };
}

export { getNodeByPath, listRoutes };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run src/lib/content/plainText.test.ts src/lib/content/context.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement `index.ts` (virtual:vault glue, build-time)**

```ts
// app/src/lib/content/index.ts
import { files, assets } from 'virtual:vault';
import readingTime from 'reading-time';
import { buildContext, getNodeByPath, listRoutes, extractToc, siblings } from './context';
import { groupChildren } from './tree';
import { renderMarkdown } from './markdown';
import { toPlainText } from './plainText';
import type { Context } from './context';

let _ctx: Context | null = null;
function ctx(): Context { return (_ctx ??= buildContext(files, assets)); }

export function listAllRoutes() {
  // language list lives in $lib/languages (Task 13); 'it' for now
  return listRoutes(ctx().root).map((r) => ({ lang: 'it', path: r.path }));
}

export async function renderNode(lang: string, path: string) {
  const c = ctx();
  const node = path === '' ? c.root : getNodeByPath(c.root, path.split('/'));
  if (!node) throw new Error(`404 ${lang}/${path}`);

  if (node.kind === 'folder') {
    const html = node.content ? await renderMarkdown(node.content, c.resolve) : '';
    const g = groupChildren(node);
    return { kind: 'folder' as const, lang, node: stripBody(node), html, groups: prefixGroups(g, lang) };
  }
  const html = await renderMarkdown(node.content, c.resolve);
  const stats = readingTime(toPlainText(node.content));
  const sib = siblings(c.root, node.path);
  return {
    kind: 'note' as const, lang,
    node: { ...node, content: '' },
    html, toc: extractToc(html), readingText: stats.text,
    prev: sib.prev && { title: sib.prev.title, path: `/${lang}/${sib.prev.path}` },
    next: sib.next && { title: sib.next.title, path: `/${lang}/${sib.next.path}` }
  };
}

// helpers prefix child paths with /lang and drop heavy bodies for the payload
function stripBody(f: any) { return { ...f, content: '', children: undefined }; }
function prefixGroups(g: any, lang: string) {
  const map = (n: any) => ({ slug: n.slug, title: n.title, description: n.description,
    image: n.image, type: n.type, url: `/${lang}/${n.path}` });
  return { modules: g.modules.map(map), lectures: g.lectures.map(map), resources: g.resources.map(map) };
}
```

Install reading-time: `cd app && npm i reading-time`.

- [ ] **Step 7: Run the full unit suite**

Run: `cd app && npx vitest run`
Expected: all suites PASS (`index.ts` is exercised by the build in later tasks).

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/content/ app/package.json app/package-lock.json
git commit -m "feat(content): context (resolvers, toc, siblings) + virtual:vault rendering API"
```

---

## Task 9: Homepage route (`/[lang]`) — course grid

**Files:**
- Modify: `app/src/routes/[lang]/+page.ts`, `app/src/routes/[lang]/+page.svelte`
- Create: `app/src/lib/components/CourseCard.svelte`

**Interfaces:**
- Consumes: `renderNode` (Task 8) with `path: ''` → folder data whose `groups.modules`
  are the courses.

- [ ] **Step 1: Load the course list**

Replace `app/src/routes/[lang]/+page.ts`:

```ts
import type { EntryGenerator, PageLoad } from './$types';
import { renderNode } from '$lib/content';
export const prerender = true;
export const entries: EntryGenerator = () => [{ lang: 'it' }];
export const load: PageLoad = async ({ params }) => {
  const data = await renderNode(params.lang, ''); // root folder = course list
  return { lang: params.lang, courses: data.kind === 'folder' ? data.groups.modules : [] };
};
```

- [ ] **Step 2: CourseCard + homepage markup**

`app/src/lib/components/CourseCard.svelte`:

```svelte
<script lang="ts">
  let { title, description, image, url }:
    { title: string; description: string; image?: string; url: string } = $props();
</script>
<a class="card" href={url}>
  {#if image}<img src={image} alt="" />{/if}
  <h2>{title}</h2>
  <p>{description}</p>
</a>
<style>
  .card { display: block; padding: 1.2rem; border-radius: 1rem;
    background: color-mix(in srgb, var(--secondary) 70%, transparent);
    border: 1px solid var(--accent2); color: var(--background-text); }
  .card:hover { border-color: var(--accent); }
  img { width: 100%; border-radius: .6rem; margin-bottom: .8rem; }
  h2 { font-family: Rubik, sans-serif; }
  p { color: var(--hint); }
</style>
```

`app/src/routes/[lang]/+page.svelte`:

```svelte
<script lang="ts">
  import type { PageProps } from './$types';
  import CourseCard from '$lib/components/CourseCard.svelte';
  let { data }: PageProps = $props();
</script>
<section class="hero"><h1>Appunti universitari</h1></section>
<div class="grid">
  {#each data.courses as c}
    <CourseCard title={c.title} description={c.description} image={c.image} url={c.url} />
  {/each}
</div>
<style>
  .hero { padding: 3rem 1rem 1rem; }
  .grid { display: grid; gap: 1rem; padding: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); }
</style>
```

- [ ] **Step 3: Verify (needs fixture content — deferred to Task 16)**

For now: `cd app && npm run build` must still **succeed** (the homepage will show
an empty grid until `it/` exists). Confirm no build error.

- [ ] **Step 4: Commit**

```bash
git add app/src/routes/[lang]/+page.ts app/src/routes/[lang]/+page.svelte app/src/lib/components/CourseCard.svelte
git commit -m "feat(app): homepage course grid"
```

---

## Task 10: Catch-all route (`/[lang]/[...path]`) — folder + note pages

**Files:**
- Create: `app/src/routes/[lang]/[...path]/+page.server.ts`,
  `app/src/routes/[lang]/[...path]/+page.svelte`,
  `app/src/lib/components/Breadcrumbs.svelte`,
  `app/src/lib/components/NoteNav.svelte`,
  `app/src/lib/components/Toc.svelte`

**Interfaces:**
- Consumes: `renderNode`, `listAllRoutes` (Task 8).

- [ ] **Step 1: Server load + entries**

`app/src/routes/[lang]/[...path]/+page.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { renderNode, listAllRoutes } from '$lib/content';
export const prerender = true;
export const entries: EntryGenerator = async () => listAllRoutes();
export const load: PageServerLoad = async ({ params }) => {
  try { return await renderNode(params.lang, params.path); }
  catch { error(404, 'Not found'); }
};
```

- [ ] **Step 2: Page switches folder vs note**

`app/src/routes/[lang]/[...path]/+page.svelte`:

```svelte
<script lang="ts">
  import type { PageProps } from './$types';
  import CourseCard from '$lib/components/CourseCard.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import NoteNav from '$lib/components/NoteNav.svelte';
  import Toc from '$lib/components/Toc.svelte';
  let { data }: PageProps = $props();
</script>

<Breadcrumbs lang={data.lang} path={data.node.path} title={data.node.title} />

{#if data.kind === 'folder'}
  <article class="content">
    <h1>{data.node.title}</h1>
    <p class="desc">{data.node.description}</p>
    {#if data.html}<div class="md">{@html data.html}</div>{/if}
    {#if data.groups.modules.length}
      <h2>Moduli</h2>
      <div class="grid">
        {#each data.groups.modules as m}
          <CourseCard title={m.title} description={m.description} image={m.image} url={m.url} />
        {/each}
      </div>
    {/if}
    {#if data.groups.lectures.length}
      <h2>Lezioni</h2>
      <ol class="list">
        {#each data.groups.lectures as n}<li><a href={n.url}>{n.title}</a><span>{n.description}</span></li>{/each}
      </ol>
    {/if}
    {#if data.groups.resources.length}
      <h2>Risorse</h2>
      <ul class="list">
        {#each data.groups.resources as n}<li><a href={n.url}>{n.title}</a><span>{n.description}</span></li>{/each}
      </ul>
    {/if}
  </article>
{:else}
  <article class="content note">
    <header><h1>{data.node.title}</h1><p class="meta">{data.readingText} · {data.node.description}</p></header>
    {#if data.toc.length}<Toc items={data.toc} />{/if}
    <div class="md">{@html data.html}</div>
    <NoteNav prev={data.prev} next={data.next} />
  </article>
{/if}

<style>
  .content { max-width: calc(80ch + 2rem); margin: 2rem auto; padding: 1rem; }
  .desc, .meta { color: var(--hint); }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); }
  .list { display: flex; flex-direction: column; gap: .5rem; }
  .list span { color: var(--hint); margin-left: .6rem; }
</style>
```

- [ ] **Step 3: Supporting components**

`Breadcrumbs.svelte` (build a trail from `lang` + `path` segments, link each
ancestor), `NoteNav.svelte` (render `prev`/`next` link objects when present),
`Toc.svelte` (render the `items` list as anchor links to `#id`). Keep each ~20
lines, styled with theme vars.

- [ ] **Step 4: Verify build still succeeds**

Run: `cd app && npm run build`
Expected: success (no nodes yet beyond an empty root → no catch-all entries; the
route compiles). Full prerender of real pages is validated in Task 16.

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/[lang]/[...path]/ app/src/lib/components/Breadcrumbs.svelte app/src/lib/components/NoteNav.svelte app/src/lib/components/Toc.svelte
git commit -m "feat(app): folder + note pages via catch-all route"
```

---

## Task 11: Theme system + toggle

**Files:**
- Create: `app/src/lib/theme.svelte.ts`, `app/src/lib/components/ThemeToggle.svelte`
- Modify: `app/src/app.css`, `app/src/routes/+layout.svelte`
- Test: `app/src/lib/theme.test.ts`

**Interfaces:**
- Produces: `themeState`, `applyTheme`, `toggleTheme`, `hydrateTheme`, plus a
  pure `nextTheme(name)` helper for unit testing.

- [ ] **Step 1: Write the failing test (pure helper)**

```ts
// app/src/lib/theme.test.ts
import { describe, it, expect } from 'vitest';
import { nextTheme, THEMES } from './theme.svelte';
describe('theme', () => {
  it('toggles between dark and light', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
  it('uses the spec palette (specy.app accent)', () => {
    expect(THEMES.dark['--accent']).toBe('#a65ee0');
    expect(THEMES.light['--accent']).toBe('#da0363');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/theme.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — create `app/src/lib/theme.svelte.ts` = **TR §J**,
  and additionally export `export const nextTheme = (n: 'light'|'dark') => n === 'dark' ? 'light' : 'dark';`
  and export the `THEMES` map.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/theme.test.ts`
Expected: PASS.

- [ ] **Step 5: ThemeToggle + layout wiring**

`ThemeToggle.svelte`:

```svelte
<script lang="ts">
  import { themeState, toggleTheme } from '$lib/theme.svelte';
</script>
<button onclick={toggleTheme} aria-label="Toggle theme">
  {themeState.name === 'dark' ? '☀️' : '🌙'}
</button>
```

In `app/src/routes/+layout.svelte`: import `'katex/dist/katex.min.css'`, import
`'../app.css'`, call `hydrateTheme` in `onMount` (per TR §J layout snippet).

Append the Shiki/KaTeX/callout CSS from **TR §J** to `app/src/app.css`, plus base
`body { background: var(--background); color: var(--background-text); }` and the
theme-aware article (`.md`) typography (Noto Serif body, Rubik headings, Fira
Code code) refactored from specy.app's `BlogLayout` to use theme vars instead of
hardcoded dark colors.

- [ ] **Step 6: Build + commit**

Run: `cd app && npm run build` (expect success), then:

```bash
git add app/src/lib/theme.svelte.ts app/src/lib/theme.test.ts app/src/lib/components/ThemeToggle.svelte app/src/app.css app/src/routes/+layout.svelte
git commit -m "feat(app): FOUC-safe theme system + toggle (specy.app palette)"
```

---

## Task 12: Nav + blobs background + language switcher

**Files:**
- Create: `app/src/lib/components/Nav.svelte`, `app/src/lib/components/Background.svelte`,
  `app/src/lib/components/LanguageSwitcher.svelte`
- Modify: `app/src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `themeState`/`ThemeToggle` (Task 11), `page` from `$app/state` for the
  current `lang`/`path`.

- [ ] **Step 1: Port the blobs background**

Create `app/src/lib/components/Background.svelte` by porting specy.app's
`Background.svelte` (the blurred Game-of-Life canvas). Replace its
`currentTheme.getColor('accent')` with reading
`getComputedStyle(document.documentElement).getPropertyValue('--accent')`, and
re-run on theme change via an `$effect` that depends on `themeState.name`.

- [ ] **Step 2: Nav + language switcher**

`LanguageSwitcher.svelte`: links to the same page under each language prefix
(swap the first path segment), reading current path from `page.url.pathname`.
`Nav.svelte`: site title (link to `/{lang}`), `<ThemeToggle />`, `<LanguageSwitcher />`.

- [ ] **Step 3: Compose the layout**

Update `app/src/routes/+layout.svelte` to wrap content in `<Background>` with
`<Nav />` above `{@render children?.()}`, mirroring specy.app's layout structure
(Background → Nav → content). Keep `hydrateTheme` + CSS imports from Task 11.

- [ ] **Step 4: Verify dev render**

Run: `cd app && npm run dev`, open `/it` — confirm: blurred accent blobs animate,
theme toggle flips palette + blobs recolor, language switcher present, no console
errors. Stop dev.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/components/Nav.svelte app/src/lib/components/Background.svelte app/src/lib/components/LanguageSwitcher.svelte app/src/routes/+layout.svelte
git commit -m "feat(app): nav, blobs background, language switcher"
```

---

## Task 13: i18n (UI strings + language config)

**Files:**
- Create: `app/src/lib/languages.ts`, `app/src/lib/i18n/index.ts`,
  `app/src/lib/i18n/it.json`, `app/src/lib/i18n/en.json`
- Test: `app/src/lib/i18n/i18n.test.ts`

**Interfaces:**
- Produces: `LANGUAGES` (`{ it: {label,contentRoot}, en: {label,contentRoot:'it'} }`),
  `t(lang: string, key: string): string` with fallback to `it` then the key.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/i18n/i18n.test.ts
import { describe, it, expect } from 'vitest';
import { t } from './index';
import { LANGUAGES } from '../languages';
describe('i18n', () => {
  it('returns the localized string', () => { expect(t('it', 'nav.home')).toBe('Home'); });
  it('falls back to it then the key', () => {
    expect(t('en', 'nav.home')).toBe(t('it', 'nav.home')); // en aliases it copy if missing
    expect(t('it', 'does.not.exist')).toBe('does.not.exist');
  });
  it('aliases en content root to it for now', () => {
    expect(LANGUAGES.en.contentRoot).toBe('it');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/i18n/i18n.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`languages.ts`:
```ts
export const LANGUAGES = {
  it: { label: 'Italiano', contentRoot: 'it' },
  en: { label: 'English', contentRoot: 'it' } // aliased until EN content exists
} as const;
export type Lang = keyof typeof LANGUAGES;
```

`i18n/it.json` (seed keys): `{ "nav.home": "Home", "course.lectures": "Lezioni", "course.resources": "Risorse", "course.modules": "Moduli", "note.prev": "Precedente", "note.next": "Successivo", "note.toc": "Indice" }`.
`i18n/en.json`: `{ "nav.home": "Home", "course.lectures": "Lectures", "course.resources": "Resources", "course.modules": "Modules", "note.prev": "Previous", "note.next": "Next", "note.toc": "Contents" }`.

`i18n/index.ts`:
```ts
import it from './it.json';
import en from './en.json';
const DICTS: Record<string, Record<string, string>> = { it, en };
export function t(lang: string, key: string): string {
  return DICTS[lang]?.[key] ?? DICTS.it[key] ?? key;
}
```

- [ ] **Step 4: Run test to verify it passes** — `cd app && npx vitest run src/lib/i18n/i18n.test.ts` → PASS.

- [ ] **Step 5: Wire UI strings** — replace hardcoded "Moduli"/"Lezioni"/"Risorse"
  (Task 10), "Home" (Nav), prev/next/ToC labels with `t(data.lang, …)`.

- [ ] **Step 6: Build + commit**

```bash
git add app/src/lib/languages.ts app/src/lib/i18n/ app/src/routes app/src/lib/components
git commit -m "feat(app): i18n UI strings + language config (en aliases it)"
```

---

## Task 14: Client render hydration (Mermaid + foldable callouts)

**Files:**
- Create: `app/src/lib/components/Mermaid.svelte`, `app/src/lib/components/RenderedMarkdown.svelte`
- Modify: note + folder pages to render via `RenderedMarkdown`

**Interfaces:**
- Produces: `RenderedMarkdown` takes `html: string`; on mount it (a) finds
  fenced `mermaid` code blocks and renders them with the Mermaid component, and
  (b) wires `.callout[data-callout-fold]` click-to-fold.

- [ ] **Step 1: Install + Mermaid component** — `cd app && npm i mermaid`; create
  `Mermaid.svelte` = **TR §J**.

- [ ] **Step 2: RenderedMarkdown**

```svelte
<!-- app/src/lib/components/RenderedMarkdown.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { themeState } from '$lib/theme.svelte';
  import { mount } from 'svelte';
  import Mermaid from './Mermaid.svelte';
  let { html }: { html: string } = $props();
  let el: HTMLElement;
  $effect(() => {
    const _t = themeState.name; if (!browser || !el) return;
    // Shiki marks mermaid as a code block; find raw mermaid source blocks.
    el.querySelectorAll('pre > code.language-mermaid, code.language-mermaid').forEach((node) => {
      const code = node.textContent ?? '';
      const host = document.createElement('div');
      node.closest('pre')?.replaceWith(host);
      mount(Mermaid, { target: host, props: { code, theme: _t === 'dark' ? 'dark' : 'default' } });
    });
    el.querySelectorAll('.callout[data-callout-fold]').forEach((c) => {
      const title = c.querySelector('.callout-title');
      title?.addEventListener('click', () => c.classList.toggle('folded'));
    });
  });
</script>
<div class="md" bind:this={el}>{@html html}</div>
```

> Note: with `defaultColor:false` Shiki may class mermaid blocks as `.shiki`
> language-mermaid; if so, target `[lang="mermaid"]`/`.language-mermaid` on the
> `pre`. Verify the actual class in Step 4 and adjust the selector.

- [ ] **Step 3: Use it** — in folder + note pages replace `<div class="md">{@html …}</div>`
  with `<RenderedMarkdown html={…} />`.

- [ ] **Step 4: Verify** — add a temp note with a ```mermaid block + a foldable
  `> [!note]- folded` callout to the fixture (or test in Task 16); `npm run dev`,
  confirm the diagram renders and the callout folds. Remove temp note.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/components/Mermaid.svelte app/src/lib/components/RenderedMarkdown.svelte app/src/routes
git commit -m "feat(app): client hydration for mermaid + foldable callouts"
```

---

## Task 15: Excalidraw → SVG export pipeline

**Files:**
- Create: `app/scripts/readExcalidrawScene.mjs`, `app/scripts/excalidrawExporter.mjs`,
  `app/scripts/buildExcalidraw.mjs`
- Modify: `app/package.json` (prebuild script), `app/vite-plugin-vault.js`
  (merge excalidraw map into `assets`), `app/src/lib/content/context.ts`
  (`asset()` handles `.excalidraw` → dual-theme markup)
- Test: `app/scripts/readExcalidrawScene.test.mjs`

**Interfaces:**
- Produces: `static/vault-assets/excalidraw/<name>.{light,dark}.svg` + a
  `excalidraw-map.json` (`{ "<name>.excalidraw": { light, dark } }`) consumed by
  the plugin; `readExcalidrawScene(filePath) → scene`.

- [ ] **Step 1: Install** — `cd app && npm i -D lz-string playwright && npx playwright install chromium`.

- [ ] **Step 2: TDD the scene reader against a real fixture**

Copy one real drawing into a fixtures dir:
```bash
mkdir -p app/scripts/__fixtures__
cp "../reti/Excalidraw/Drawing 2024-11-11 09.12.21.excalidraw.md" app/scripts/__fixtures__/sample.excalidraw.md
```

```js
// app/scripts/readExcalidrawScene.test.mjs
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readExcalidrawScene } from './readExcalidrawScene.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
describe('readExcalidrawScene', () => {
  it('decompresses the compressed-json fence to a scene with elements', () => {
    const scene = readExcalidrawScene(path.join(here, '__fixtures__/sample.excalidraw.md'));
    expect(Array.isArray(scene.elements)).toBe(true);
    expect(scene.elements.length).toBeGreaterThan(0);
  });
});
```

Run: `cd app && npx vitest run scripts/readExcalidrawScene.test.mjs` → FAIL.

- [ ] **Step 3: Implement reader** — `app/scripts/readExcalidrawScene.mjs` = **TR §I** reader. Re-run → PASS.

- [ ] **Step 4: Implement exporter + runner**

`excalidrawExporter.mjs` = **TR §I** exporter. `buildExcalidraw.mjs`: walk
`../it` (and, pre-conversion, also `../reti` etc. is out of scope — only `../it`)
for `*.excalidraw.md`, boot one exporter, export light+dark into
`static/vault-assets/excalidraw/`, write `excalidraw-map.json`. On any failure
log + skip (placeholder fallback). Add to `package.json`:

```json
"scripts": { "prebuild": "node scripts/buildExcalidraw.mjs", "build": "vite build" }
```

- [ ] **Step 5: Plugin + resolver integration**

In `vite-plugin-vault.js`, read `excalidraw-map.json` (if present) and merge into
the `assets` map keyed by the `.excalidraw` basename. In `context.ts`, make
`resolve.asset(target)`: if `target` ends with `.excalidraw` and a map entry
exists, return a sentinel the embed handler turns into a `<picture>` (light/dark)
— simplest: store both URLs and emit an HTML `<picture><source media dark><img></picture>`
via a raw HTML mdast node in `remarkObsidianLinks` when the target is excalidraw.
If missing, return a placeholder `#excalidraw-missing`.

- [ ] **Step 6: Verify** — `cd app && node scripts/buildExcalidraw.mjs` produces
  SVGs for the sample; confirm `static/vault-assets/excalidraw/*.light.svg` exists
  and is valid XML.

- [ ] **Step 7: Commit**

```bash
git add app/scripts/ app/package.json app/package-lock.json app/vite-plugin-vault.js app/src/lib/content/context.ts app/src/lib/content/remarkObsidianLinks.ts
git commit -m "feat(app): build-time Excalidraw -> dual-theme SVG export"
```

---

## Task 16: Convert `fisica` to the contract + full end-to-end build

**Files:**
- Create: `it/` (new content root), `it/02-fisica/index.md`
- Move/rename: `fisica/*` → `it/02-fisica/NN-*.md`, attachments along with them
- Modify: each fisica note's frontmatter to the contract; rewrite `[[L0x]]` links

**Interfaces:**
- Produces: a real single-course site proving the whole pipeline.

- [ ] **Step 1: Create the language root and move fisica**

```bash
mkdir -p it/02-fisica
git mv fisica/attachments it/02-fisica/attachments 2>/dev/null || true
```
Move each `fisica/L0N.md` → `it/02-fisica/0N-<slug>.md` (slug from the lesson
title, kebab-case, accents stripped), `fisica/formulario.md` →
`it/02-fisica/90-formulario.md`, `fisica/index.md` → `it/02-fisica/index.md`.
Use `git mv` so history is preserved.

- [ ] **Step 2: Frontmatter to contract**

Rewrite `it/02-fisica/index.md` frontmatter to `{ title, description, image? }`
(keep the existing overview body + lecture list, or let the course page generate
the index — keep the prose overview, drop the manual `[[L0x]]` list since the
page renders Lectures automatically). For each lecture set frontmatter
`{ title, description, type: lecture }` (fisica already has `titolo`/`argomenti`
— map `titolo`→`title`, synthesize a one-line `description` from the abstract).
Set `90-formulario.md` `type: resource`.

- [ ] **Step 3: Rewrite wikilinks** — replace `[[L01]]`→`[[introduzione-…]]` etc.
  to match new slugs (the resolver matches by title too, so title-based links
  also work; verify the formulario link `[[formulario]]` still resolves).

- [ ] **Step 4: Full build**

Run: `cd app && npm run build`
Expected: PASS with `strict:true`. Confirm prerendered output exists:
`app/build/it.html` (homepage shows the Fisica card), `app/build/it/fisica.html`
(course page: overview + Lezioni list + Risorse), and one lecture e.g.
`app/build/it/fisica/<slug>.html`.

- [ ] **Step 5: Preview + manual checks**

Run: `cd app && npm run preview`. Verify on a lecture page: KaTeX math renders,
callouts styled, embedded images load from `/vault-assets/…`, code (if any)
highlighted, theme toggle flips everything (incl. Shiki/KaTeX), language switch
keeps you on the page, prev/next + breadcrumbs + ToC work. Stop preview.

- [ ] **Step 6: Commit**

```bash
git add it/ app/
git commit -m "feat(content): convert fisica to the contract; validate full build"
```

---

## Self-review notes (resolved)

- **Spec coverage:** homepage (T9), course/module pages with typed sections
  (T10), note pages w/ frontmatter title+description (T10), recursive modules
  (T3/T10), `index.md` descriptors (T3), `NN-slug` ordering + prefix-stripped
  URLs (T2/T3), navigable-vs-asset rule (T3), markdown pipeline incl. math /
  callouts / wikilinks / embeds / code (T4-T6), Excalidraw (T15), Mermaid (T14),
  SVG embeds (T7 asset copy), dark/light toggle + blobs + fonts (T11/T12),
  i18n + `en`→`it` alias (T13), static deploy at root (T1), single-source vault
  read from `../it` (T7/T8). Excalidraw `.drawio.svg` inline = handled by the
  generic SVG asset copy in T7.
- **Excalidraw risk** is isolated in T15 with a placeholder fallback so it never
  blocks the build (spec §4.3).
- **Plan 2** (the other 7 courses' bulk conversion) intentionally deferred.
