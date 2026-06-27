# University Notes Site — Design Spec

**Date:** 2026-06-26
**Status:** Approved (design); pending implementation plan
**Author:** Specy + Claude

## 1. Goal

Turn an existing Obsidian vault of university CS/maths notes into a public,
navigable website where students can browse courses and read lectures. The site
is built with SvelteKit and lives in the `app/` subfolder of the vault repo. It
borrows the visual identity of the specy.app blog (fonts, colors, blurred
"blobs" background, dark/light theming) but uses a **purpose-built markdown
pipeline** for Obsidian-flavored content.

The codebase must be **generic to notes** — it discovers content by convention,
not by hardcoding course names — and **i18n-ready** from day one, even though
only Italian content exists now.

## 2. Key decisions (locked)

1. **Vault relationship:** single source of truth in the vault. Conversion is
   *in-place with gentle renames*: add standardized frontmatter + folder index
   files, normalize filenames, flatten/restructure as needed, and rewrite
   wikilinks to match. Obsidian keeps working.
2. **i18n model:** language selects a **content root**. Structure is
   `[lang]/[course]/…/[lecture]`. Today only `it/` has content; `en` is
   *aliased to `it`* via app config (one value to flip when translations exist).
   The language toggle translates **UI chrome only** for now; notes render in
   their authored language.
3. **Render fidelity:** must-haves — LaTeX (KaTeX), Obsidian callouts,
   wikilinks, image embeds. Plus, at launch: **Excalidraw drawings** (build-time
   export to SVG), **Mermaid** diagrams, **`.drawio.svg`/SVG** inline embeds,
   and **syntax-highlighted code**.
4. **Curation:** publish-by-default (`published: false` to opt out). A note's
   `type` sorts it into **Lectures** vs **Resources** on the course page.
5. **Hierarchy:** recursive tree — a course may contain **modules**
   (subfolders), which may contain lectures (and further modules). Optional
   middle layer: `[lang]/[course]/[module]/[lecture]`.
6. **Naming convention:** every folder and note file is `NN-slug`
   (zero-padded), so folders and files **interleave by number** when sorted.
7. **Folder descriptor file:** `index.md` (matches the existing
   `fisica/index.md` convention; clean routing; exempt from the `NN-` rule).
8. **Deployment:** custom domain / served at root. No base path.

## 3. Content model

### 3.1 Target vault layout

```
<repo>/
├─ app/                         # SvelteKit site (new)
├─ it/                          # Italian content root (8 courses moved here)
│  ├─ 01-analisi/
│  │  ├─ index.md
│  │  ├─ 01-serie-e-successioni.md
│  │  └─ …
│  ├─ 02-basi-di-dati/
│  │  ├─ index.md
│  │  ├─ 01-teoria/             # module
│  │  │  ├─ index.md
│  │  │  └─ 01-introduzione.md …
│  │  └─ 02-laboratorio/        # module
│  │     ├─ index.md
│  │     └─ 01-progetto.md
│  └─ …  (ai, fisica, reti, statistica, data-mining, algoritmica-avanzata)
├─ en/                          # (future) English root; app aliases en → it for now
└─ .obsidian/, README.md, attachments/…
```

Courses move under `it/` immediately so the future `[lang]/…` shape exists from
day one. Obsidian simply shows `it/`, `en/`, `app/` at the top level.

### 3.2 Frontmatter contracts

**Folder `index.md`** (course *or* module — one recursive schema):

```yaml
---
title: Intelligenza Artificiale
description: Agenti, ricerca, CSP, machine learning e deep learning.  # card/summary
image: attachments/cover.webp        # optional cover, relative to this folder
order: 1                             # optional; defaults to the folder's NN prefix
published: true                      # optional; default true
---
Longer overview in markdown — what the course covers, prerequisites, etc.
```

**Note `NN-slug.md`** (leaf):

```yaml
---
title: Introduzione all'AI
description: Definizione e obiettivi dell'AI, storia e tipologie.
type: lecture        # lecture (default) | resource | exercise | exam | summary
order: 1             # optional; defaults to the file's NN prefix
published: true      # optional; default true
tags: []             # optional
---
```

`title` and `description` are required on every node and are derived from the
note's own content during conversion.

### 3.3 Conventions & rules

- **Sorting:** by `order` (frontmatter override → else the `NN-` prefix).
  Folders and files in the same directory interleave on this single key.
- **Slugs / URLs:** the `NN-` prefix is stripped for the URL.
  `it/01-ai/01-introduzione.md` → `/it/ai/introduzione`.
- **Classification on a folder page:** child **modules** render as cards;
  `type: lecture` notes form the **Lectures** index; all other types form
  **Resources**. Each group is independently ordered.
- **`type: summary`** is used for redundant full-dump notes (`9 - Tutto`, etc.)
  so they appear under Resources rather than as lectures.
- **Links:** during conversion, all `[[wikilinks]]`, `[[target|alias]]`, and
  `![[embeds]]` are rewritten to the new filenames.
- **Navigable vs asset folders:** a folder is a navigable course/module **only
  if it contains an `index.md`**. Folders without one (`attachments/`, per-course
  `Excalidraw/`) are treated as **asset stores** — ignored in the nav tree, but
  their files remain referenceable as embeds/assets. This convention keeps image
  and drawing folders out of the navigation without an explicit ignore list.
- **Standalone `.excalidraw.md`** files are exported to SVG and referenceable as
  embeds; they are not shown as nav entries on their own.
- **Content root only:** scanning starts at the language content root (`it/`),
  so vault-root cruft (`README.md`, `Idee.md`, `Untitled.*`, top-level
  `Excalidraw/`) is naturally excluded.

### 3.4 Course inventory (current → converted)

8 courses, ~102 notes, ~556 attachment images. Only `fisica` is already
well-structured (has `index.md` + per-lesson frontmatter). The other seven need
frontmatter, filename normalization, and an authored `index.md`. `data-mining`
content is in English; it still lives under `it/` for now (the toggle is UI-only)
and will move to `en/` when the vault is reorganized by language.

## 4. App architecture

### 4.1 Stack

SvelteKit 2 + Svelte 5 + `@sveltejs/adapter-static` (fully prerendered) + SCSS.
Served at a domain root; `paths.base = ''`.

### 4.2 Markdown pipeline (built anew)

Build-time `unified` (remark → rehype) producing **HTML strings**. Chosen over
`mdsvex` (no native Obsidian syntax) and runtime `markdown-it` (ships a parser +
KaTeX + highlighter to every visitor). Build-time keeps the client lean and fits
prerendering.

`src/lib/content/markdown.ts` chain:

1. `remark-parse`
2. `remark-gfm`
3. `remark-math`
4. **custom remark plugins:**
   - Obsidian wikilinks `[[target]]` / `[[target|alias]]` → resolved internal links
   - embeds `![[file]]` → image (or, future, transclusion)
   - callouts `> [!type] Title` → styled callout markup
5. `remark-rehype`
6. `rehype-katex`
7. `rehype-slug` + `rehype-autolink-headings`
8. **`rehype-shiki`** — dual light/dark themes
9. `rehype-stringify`

Mermaid blocks are left as fenced code and hydrated client-side by a small
`Mermaid.svelte` (ported from specy.app). Frontmatter parsed with `gray-matter`.

### 4.3 Content layer = Vite plugin + thin loaders

A **`vault` Vite plugin** (`src/vite-plugin-vault.ts`) owns all filesystem/vault
concerns at build time so routes stay trivial:

- Walks the configured content root (`../it`) and builds the **node tree**
  (folders + notes; parsed frontmatter; prefix-stripped slugs; ordering).
- Renders every note through the pipeline → HTML.
- **Exports Excalidraw** `.excalidraw.md` scenes → light + dark SVG.
- **Collects assets:** copies referenced `attachments/` images and exported SVGs
  into the build output with stable hashed URLs; rewrites `src`/embed links in
  the rendered HTML.
- Emits a lightweight **manifest** (tree + metadata, no bodies) for fast nav,
  plus per-note rendered HTML.

SvelteKit loaders read the manifest/HTML only. Everything is static.

**Risk flagged:** headless Excalidraw → SVG export is the fiddliest piece
(Obsidian stores the scene JSON inside the `.excalidraw.md`). Prototype early;
fallback for an unexportable scene is a placeholder that links to the source.

### 4.4 Routing

- `/` → redirect to stored/default language (`/it`).
- `/[lang]` → **homepage**: course-card grid for that language.
- `/[lang]/[...path]` → single catch-all; the loader resolves the slug path to a
  **folder** (→ course/module page) or a **note** (→ article page). All routes
  prerendered by enumerating the tree.

### 4.5 Pages & components

- **Nav:** site title, breadcrumbs, **language switcher**, **dark/light toggle**.
- **Homepage:** hero + `CourseCard` grid (cover image, title, description).
- **Folder page** (course/module): cover + title + rendered overview, then child
  **module cards**, a **Lectures** list, and a **Resources** list (grouped by
  `type`, each ordered).
- **Note page:** blog-style article (title, description, reading time), rendered
  content, in-folder **prev/next**, a heading **ToC**, breadcrumbs.
- Supporting: `Callout.svelte`, `Mermaid.svelte`, KaTeX CSS, code-block styles,
  Excalidraw image embed.

### 4.6 Theme, background, fonts

Port specy.app's `ThemeProvider` + theme store and CSS-variable system:

- Dark: bg `#171A21`, accent `#a65ee0`. Light: bg `#fafafa`, accent `#da0363`.
- **Dark/light toggle persisted to localStorage.**
- Port `Background.svelte` (the blurred Conway's-Game-of-Life "blobs").
- Fonts: Rubik (UI/headings), Noto Serif (body), Fira Code (code).
- **Refactor** the blog's article CSS (currently hardcoded dark) to be
  theme-aware so notes read well in both modes.

### 4.7 i18n

`src/lib/i18n/` with `it.json` / `en.json` for **UI strings only**, keyed off the
`[lang]` route param.

```ts
LANGUAGES = {
  it: { label: 'Italiano', contentRoot: 'it' },
  en: { label: 'English',  contentRoot: 'it' }, // aliased for now
}
```

Flip `en.contentRoot` to `'en'` once translations exist — no code changes.

### 4.8 `app/` structure

```
app/src/
├─ lib/content/   (markdown.ts, tree.ts, excalidraw.ts, types.ts)
├─ lib/i18n/      (index.ts, it.json, en.json)
├─ lib/theme/     (ported ThemeProvider + store)
├─ components/    (Nav, CourseCard, Callout, Mermaid, Background, ThemeToggle, Toc…)
├─ routes/        (+layout, [lang]/+page, [lang]/[...path])
└─ vite-plugin-vault.ts
```

## 5. Phasing (for the implementation plan)

The work splits into clearly separable phases; details go into the
implementation plan, not this spec.

- **Phase A — App skeleton + content contract.** Stand up SvelteKit, theme,
  background, nav, i18n scaffold, and the content-tree types/loader. Validate
  against the *already-structured* `fisica` course.
- **Phase B — Markdown pipeline.** The full remark/rehype chain (math, callouts,
  wikilinks, embeds, code highlighting), Mermaid, SVG embeds, and the asset
  collection step.
- **Phase C — Excalidraw export.** Build-time scene → dual-theme SVG, with the
  placeholder fallback.
- **Phase D — Bulk content conversion.** Normalize filenames, derive
  `title`/`description` per note (AI-assisted fan-out), inject frontmatter,
  author each `index.md`, model modules (incl. `base-di-dati`), rewrite links.
- **Phase E — Polish + deploy.** Folder/note pages, prev/next, ToC, responsive,
  language switch, static build at domain root.

## 6. Out of scope (YAGNI)

- Content translation (EN authored later; structure is ready).
- Full Obsidian transclusion of one note inside another (embeds handle images
  only for now).
- Search, comments, accounts, analytics dashboards.
- Editing through the site (the vault remains the only authoring surface).
