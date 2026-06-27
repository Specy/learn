# Content Conversion (Phase D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 7 remaining Obsidian courses (`ai`, `algoritmica-avanzata`, `analisi`, `base-di-dati`, `data-mining`, `reti`, `statistica`) into the content contract under `it/`, so the SvelteKit app (Plan 1) renders all 8 courses. `fisica` (`it/02-fisica`) is already converted and is the gold-standard reference.

**Architecture:** Each course is `git mv`-moved from its top-level dir into `it/NN-course/`, files renamed to `NN-slug.md`, every note/folder given standardized YAML frontmatter (`title`, `description`, `type`), and each folder given an authored `index.md` descriptor. Image/Excalidraw assets move along with the course; embeds resolve by basename and need no rewriting. The app's build (`npm run build`) is the integration test — it prerenders every node and surfaces unresolved embeds as `#missing-` placeholders.

**Tech Stack:** Plain markdown + YAML frontmatter; `git mv`; the existing app build (SvelteKit/Vite/unified) for verification.

**Reference:** The gold standard is `it/02-fisica/` (read `it/02-fisica/index.md` and any lecture for the exact frontmatter + body style). The contract is defined in [the design spec](../specs/2026-06-26-university-notes-site-design.md) §3.

## Global Constraints

- **Course order (locked by user):** `01-analisi`, `02-fisica` (already done — do not touch), `03-base-di-dati`, `04-statistica`, `05-algoritmica-avanzata`, `06-reti`, `07-ai`, `08-data-mining`.
- **Naming contract:** folders and note files are `NN-slug` (zero-padded 2 digits). A folder is navigable **iff** it contains `index.md` (exempt from `NN-`). `attachments/` and `Excalidraw/` folders have **no** `index.md` (asset stores). URLs strip the `NN-` prefix.
- **Slug rule:** kebab-case of the note's human title — lowercase, ASCII (strip accents: à→a, è→e, ò→o, ù→u, ì→i), drop apostrophes/punctuation, spaces→`-`, collapse repeats. Must be unique within its folder. Match fisica's descriptive style (e.g. `01-introduzione-al-corso-e-cinematica-del-punto-materiale`).
- **Ordering numbers:** lectures use their existing source number; resources/summaries/exercises/exams use `90+` so they sort after lectures (matches `90-formulario` in fisica).
- **Frontmatter contract** (every note): `title` (string, quote if it contains `:` or `'`), `description` (1–2 sentence summary for cards/SEO), `type` (`lecture` default | `resource` | `exercise` | `exam` | `summary`). Add `published: false` only to intentionally hide a note (none planned). **Do not** invent `order` unless overriding the prefix.
- **Folder `index.md` contract:** `title` + `description` frontmatter, then a `# Title` H1 and a short authored overview paragraph derived from the course's notes. Do **not** fabricate facts (docente, libro, dates) that aren't in the source. A `> [!tip]`/`> [!info]` callout is optional polish, like fisica.
- **Title/description derivation is the implementer's job** (per spec §5 Phase D "AI-assisted fan-out"): read each note's content, then write an accurate Italian (or English, for `data-mining`) title and description. The per-note slug/order/type below are the contract; titles/descriptions are derived.
- **Body is preserved verbatim** — only prepend frontmatter. Exceptions: (a) leave image embeds `![[...png]]` unchanged (resolve by basename); (b) leave Excalidraw embeds `![[Drawing ....excalidraw|100%]]` unchanged; (c) leave same-page anchor links `[[#heading]]` unchanged (the pipeline resolves them) — verify they render.
- **Assets:** `git mv` each course's `attachments/` (and `Excalidraw/`) into the new `it/NN-course/` (preserving per-module nesting for `base-di-dati`). No basename collisions exist across courses, so embeds keep working.
- **After moving a course, remove the now-empty top-level dir** (matches fisica, whose top-level dir is empty).
- **All `git mv`** (not plain `mv`) so history follows. Quote paths with spaces.
- **Commit protocol — stage ONLY content paths.** The working tree contains uncommitted `app/` styling WIP (e.g. `app/src/lib/components/*.svelte`, `app/src/app.css`) that the user is actively editing and that **must be preserved**. Never run `git add -A` / `git add .`. Stage exactly the new course tree and the emptied source dir: `git add it/<NN-course> <source-course-dir>` (the source-dir arg stages the moved-away deletions), then `git commit`. After `git mv` + prepending frontmatter, the moved files show as modified — re-stage them via the `it/<NN-course>` path. New `index.md` files are untracked — covered by the same `it/<NN-course>` path add.
- **Per-task verification:** `cd app && npm run build` succeeds; the course's pages exist under `app/build/it/<course>/`; `grep -rl "#missing-" app/build/it/<course>` is **empty** (no unresolved embeds). Then commit.

---

## Pre-flight (controller, before Task 1)

Confirm the working tree is clean on `feat/notes-site` and the app builds today:

```bash
git status --porcelain        # expect clean
cd app && npm run build        # expect success (8th course not present yet → fine)
```

Record the BASE commit (`git rev-parse HEAD`) for review packaging.

---

## Task 1: Convert `analisi` → `it/01-analisi` (flat)

**Files:**
- Move+rename: all of `analisi/*.md` → `it/01-analisi/NN-slug.md`
- Move: `analisi/attachments/` → `it/01-analisi/attachments/`
- Create: `it/01-analisi/index.md`

**Source → target mapping** (derive title/description by reading each; type in parens):

| Source | Target slug | order | type |
|---|---|---|---|
| `1. Serie e successioni.md` | `01-serie-e-successioni.md` | 1 | lecture |
| `2. Studio funzione.md` | `02-studio-di-funzione.md` | 2 | lecture |
| `3. Limiti.md` | `03-limiti.md` | 3 | lecture |
| `4. Derivate.md` | `04-derivate.md` | 4 | lecture |
| `5. Integrali.md` | `05-integrali.md` | 5 | lecture |
| `0. Screenshot utili.md` | `90-screenshot-utili.md` | 90 | resource |
| `0. Tutto.md` | `91-tutto.md` | 91 | summary |

- [ ] **Step 1:** `mkdir -p it/01-analisi`, then `git mv "analisi/attachments" "it/01-analisi/attachments"`.
- [ ] **Step 2:** For each source file: read it, derive `title` + `description`, prepend frontmatter (`title`, `description`, `type`), then `git mv` to the target path above. (270 images — large; the summary/screenshot notes are image-heavy, keep descriptions short.)
- [ ] **Step 3:** Author `it/01-analisi/index.md` — `title: Analisi Matematica` (refine if content suggests a fuller name), a `description` covering serie/successioni, limiti, derivate, integrali; H1 + short overview. Note in the overview that `91-tutto` is a full recap and `90-screenshot-utili` collects formulas/screenshots.
- [ ] **Step 4:** Remove the emptied `analisi/` dir (`rmdir analisi` or `git status` to confirm empty).
- [ ] **Step 5:** Verify: `cd app && npm run build` → success; `ls app/build/it/analisi`; `grep -rl "#missing-" app/build/it/analisi` empty.
- [ ] **Step 6:** Commit: `git add it/01-analisi analisi && git commit -m "content(analisi): convert to it/01-analisi with frontmatter"`.

---

## Task 2: Convert `base-di-dati` → `it/03-base-di-dati` (2 modules)

This course keeps its existing `teoria` / `laboratorio` split as **modules** (spec's module example).

**Files:**
- Create dirs: `it/03-base-di-dati/01-teoria/`, `it/03-base-di-dati/02-laboratorio/`
- Move+rename teoria notes and laboratorio note (below)
- Move: `base-di-dati/teoria/attachments/` → `it/03-base-di-dati/01-teoria/attachments/`; `base-di-dati/laboratorio/attachments/` → `it/03-base-di-dati/02-laboratorio/attachments/`
- Create: `it/03-base-di-dati/index.md`, `.../01-teoria/index.md`, `.../02-laboratorio/index.md`

**teoria → `01-teoria/` mapping:**

| Source | Target slug | order | type |
|---|---|---|---|
| `teoria/1 - Introduzione.md` | `01-introduzione.md` | 1 | lecture |
| `teoria/2 - Modello relazionale.md` | `02-modello-relazionale.md` | 2 | lecture |
| `teoria/3 - Algebra relazionale.md` | `03-algebra-relazionale.md` | 3 | lecture |
| `teoria/4 - Calcolo relazionale.md` | `04-calcolo-relazionale.md` | 4 | lecture |
| `teoria/5 - Forme normali.md` | `05-forme-normali.md` | 5 | lecture |
| `teoria/6 - Tecnologie per Sistemi di Database.md` | `06-tecnologie-per-sistemi-di-database.md` | 6 | lecture |
| `teoria/7 - Base di dati direzionali.md` | `07-basi-di-dati-direzionali.md` | 7 | lecture |

**laboratorio → `02-laboratorio/` mapping:**

| Source | Target slug | order | type |
|---|---|---|---|
| `laboratorio/Progetto.md` | `01-progetto.md` | 1 | resource |

- [ ] **Step 1:** Create the two module dirs; `git mv` each `attachments/` into the matching module dir.
- [ ] **Step 2:** Convert each teoria note (read → frontmatter → `git mv`). Files `3 -` and `4 -` contain same-page anchor links `[[#heading]]` — **leave them unchanged**; verify in Step 6 they render as in-page links.
- [ ] **Step 3:** Convert `laboratorio/Progetto.md` (type `resource`; it's a project track).
- [ ] **Step 4:** Author 3 `index.md` files: top-level (`title: Basi di Dati`, description spanning theory + lab, overview pointing to the two modules); `01-teoria/index.md` (`title: Teoria`); `02-laboratorio/index.md` (`title: Laboratorio`).
- [ ] **Step 5:** Remove emptied `base-di-dati/`, `base-di-dati/teoria/`, `base-di-dati/laboratorio/`.
- [ ] **Step 6:** Verify build; `ls app/build/it/base-di-dati/teoria`; `grep -rl "#missing-" app/build/it/base-di-dati` empty; spot-check an anchor link renders (`grep -o 'href="#[^"]*"' app/build/it/base-di-dati/teoria/algebra-relazionale/index.html | head`).
- [ ] **Step 7:** Commit: `git add it/03-base-di-dati base-di-dati && git commit -m "content(base-di-dati): convert to it/03-base-di-dati with teoria/laboratorio modules"`.

---

## Task 3: Convert `statistica` → `it/04-statistica` (flat)

Source files are `lezione-N` with **no titles** — derive title + description from the body. Numbering has gaps (no 6, 7) — that's fine; `order` = the lezione number.

**Files:**
- Move+rename `statistica/lezione-*.md` → `it/04-statistica/NN-slug.md` (NN = lezione number, slug derived from content)
- `statistica/Tipologie esercizi.md` → `it/04-statistica/90-tipologie-di-esercizi.md` (type `resource`)
- Move: `statistica/attachments/` → `it/04-statistica/attachments/`
- Create: `it/04-statistica/index.md`

**Mapping (slug derived from each note's actual topic — examples are hints, refine after reading):**

| Source | order | type | slug hint |
|---|---|---|---|
| `lezione-1.md` | 1 | lecture | (probability intro) e.g. `01-introduzione-alla-probabilita.md` |
| `lezione-2.md` | 2 | lecture | `02-fattoriali-e-binomiali.md` |
| `lezione-3.md` | 3 | lecture | derive |
| `lezione-4.md` | 4 | lecture | derive |
| `lezione-5.md` | 5 | lecture | derive |
| `lezione-8.md` | 8 | lecture | derive |
| `lezione-9.md` | 9 | lecture | derive |
| `lezione-10.md` | 10 | lecture | derive |
| `lezione-11.md` | 11 | lecture | derive |
| `lezione-12.md` | 12 | lecture | derive |
| `Tipologie esercizi.md` | 90 | resource | `90-tipologie-di-esercizi.md` |

- [ ] **Step 1:** `git mv "statistica/attachments" "it/04-statistica/attachments"` (1 image).
- [ ] **Step 2:** For each lezione: read body, derive a concise topic title + description, set `type: lecture`, frontmatter, `git mv` to `NN-slug` (NN = the lezione number, so 01,02,03,04,05,08,09,10,11,12). Some notes are single exercises (e.g. lezione-3/5/11 start with "# Esercizio") — title them after the exercise's subject, keep `type: lecture` (they are in-sequence class material), or use `exercise` if clearly standalone — implementer judgment.
- [ ] **Step 3:** Convert `Tipologie esercizi.md` → resource.
- [ ] **Step 4:** Author `it/04-statistica/index.md` (`title: Statistica e Probabilità` or as content suggests; description; overview).
- [ ] **Step 5:** Remove emptied `statistica/`.
- [ ] **Step 6:** Verify build; `ls app/build/it/statistica`; `grep -rl "#missing-" app/build/it/statistica` empty.
- [ ] **Step 7:** Commit: `git add it/04-statistica statistica && git commit -m "content(statistica): convert to it/04-statistica with frontmatter"`.

---

## Task 4: Convert `algoritmica-avanzata` → `it/05-algoritmica-avanzata` (flat)

Source files are `lezione-1..7` with **empty first lines / no titles** — titles and descriptions must be derived entirely from the body content. **No images** (0 attachments).

**Files:**
- Move+rename `algoritmica-avanzata/lezione-N.md` → `it/05-algoritmica-avanzata/0N-slug.md`
- Create: `it/05-algoritmica-avanzata/index.md`

**Mapping:**

| Source | order | type | slug |
|---|---|---|---|
| `lezione-1.md` … `lezione-7.md` | 1…7 | lecture | `0N-<derived-topic>.md` |

- [ ] **Step 1:** `mkdir -p it/05-algoritmica-avanzata`.
- [ ] **Step 2:** For each `lezione-N.md`: read the full body to identify the lecture's topic(s), derive a title + description, add frontmatter (`type: lecture`), `git mv` to `0N-<slug>.md`.
- [ ] **Step 3:** Author `it/05-algoritmica-avanzata/index.md` (`title: Algoritmica Avanzata`; description + overview synthesized from the 7 lectures' topics).
- [ ] **Step 4:** Remove emptied `algoritmica-avanzata/`.
- [ ] **Step 5:** Verify build; `ls app/build/it/algoritmica-avanzata` (7 lectures); `grep -rl "#missing-" app/build/it/algoritmica-avanzata` empty.
- [ ] **Step 6:** Commit: `git add it/05-algoritmica-avanzata algoritmica-avanzata && git commit -m "content(algoritmica-avanzata): convert to it/05-algoritmica-avanzata with derived titles"`.

---

## Task 5: Convert `reti` → `it/06-reti` (flat, mixed types + Excalidraw)

**Files:**
- Move+rename notes (below); Move `reti/attachments/` → `it/06-reti/attachments/`; Move `reti/Excalidraw/` → `it/06-reti/Excalidraw/`
- Create: `it/06-reti/index.md`

**Mapping:**

| Source | Target slug | order | type |
|---|---|---|---|
| `1 - Internet.md` | `01-internet.md` | 1 | lecture |
| `2 - Protocolli.md` | `02-protocolli.md` | 2 | lecture |
| `3 - TCP.md` | `03-tcp.md` | 3 | lecture |
| `4 - Router.md` | `04-router.md` | 4 | lecture |
| `5 - Routing.md` | `05-routing.md` | 5 | lecture |
| `6 - Networking.md` | `06-networking.md` | 6 | lecture |
| `7 - Wireless.md` | `07-wireless.md` | 7 | lecture |
| `8 - Sicurezza.md` | `08-sicurezza.md` | 8 | lecture |
| `Extra - Protocolli.md` | `90-extra-protocolli.md` | 90 | resource |
| `9 - Tutto.md` | `91-tutto.md` | 91 | summary |
| `Domande orale.md` | `92-domande-orale.md` | 92 | exam |
| `Esercizi prima parte.md` | `93-esercizi-prima-parte.md` | 93 | exercise |
| `Esercizi seconda parte.md` | `94-esercizi-seconda-parte.md` | 94 | exercise |

- [ ] **Step 1:** `git mv "reti/attachments" "it/06-reti/attachments"`; `git mv "reti/Excalidraw" "it/06-reti/Excalidraw"`. (The 7 `.excalidraw.md` scenes are referenced via `![[Drawing ...excalidraw|100%]]` embeds — moving the folder keeps them resolvable.)
- [ ] **Step 2:** Convert each note (read → frontmatter → `git mv`). Respect the `type` column: `9 - Tutto` is a full recap (`summary`), `Domande orale` is oral-exam prep (`exam`), the two `Esercizi` are `exercise`, `Extra - Protocolli` is reference (`resource`).
- [ ] **Step 3:** Author `it/06-reti/index.md` (`title: Reti di Calcolatori` or as content suggests; description covering the Internet/TCP/routing/wireless/security arc; overview noting the recap, exercises, and oral-exam notes under Resources).
- [ ] **Step 4:** Remove emptied `reti/`.
- [ ] **Step 5:** Verify build; `ls app/build/it/reti`; `grep -rl "#missing-" app/build/it/reti` empty. Excalidraw export runs at build (headless Chromium) — confirm the build completes and a reti page embedding a drawing has an `<svg`/excalidraw img (`grep -l excalidraw app/build/it/reti/*/index.html | head`).
- [ ] **Step 6:** Commit: `git add it/06-reti reti && git commit -m "content(reti): convert to it/06-reti with mixed types and Excalidraw"`.

---

## Task 6: Convert `ai` → `it/07-ai` (intro lecture + 2 modules + resource)

Per the user's choice, group the `2.x` and `3.x` parts into modules.

**Files:**
- Create dirs: `it/07-ai/02-ricerca-e-ragionamento/`, `it/07-ai/03-machine-learning/`
- Move `ai/attachments/` → `it/07-ai/attachments/`
- Move+rename notes (below)
- Create: `it/07-ai/index.md`, `.../02-ricerca-e-ragionamento/index.md`, `.../03-machine-learning/index.md`

**Top-level `it/07-ai/`:**

| Source | Target | order | type |
|---|---|---|---|
| `1 - Introduzione.md` | `01-introduzione.md` | 1 | lecture |
| `Domande e risposta.md` | `90-domande-e-risposte.md` | 90 | exam |

**Module `02-ricerca-e-ragionamento/`:**

| Source | Target slug | order | type |
|---|---|---|---|
| `2.1 Agenti.md` | `01-agenti.md` | 1 | lecture |
| `2.2 Ricerca.md` | `02-ricerca.md` | 2 | lecture |
| `2.3 Ricerca locale.md` | `03-ricerca-locale.md` | 3 | lecture |
| `2.4 Ricerca in ambienti complessi.md` | `04-ricerca-in-ambienti-complessi.md` | 4 | lecture |
| `2.5 CSP.md` | `05-csp.md` | 5 | lecture |
| `2.6 Sistemi multi agenti, ricerca contraddittoria e giochi.md` | `06-sistemi-multi-agente-e-giochi.md` | 6 | lecture |
| `2.7 Rappresentazione della knowledge e reasoning.md` | `07-rappresentazione-della-conoscenza.md` | 7 | lecture |

**Module `03-machine-learning/`:**

| Source | Target slug | order | type |
|---|---|---|---|
| `3.0 Machine learning.md` | `01-machine-learning.md` | 1 | lecture |
| `3.1 Reti neurali artificiali e deep learning.md` | `02-reti-neurali-e-deep-learning.md` | 2 | lecture |
| `3.2 Recurrent neural networks.md` | `03-recurrent-neural-networks.md` | 3 | lecture |
| `3.3 Seq2Seq, encoder-decoder e Attention.md` | `04-seq2seq-encoder-decoder-e-attention.md` | 4 | lecture |
| `3.4 LLM e generative AI.md` | `05-llm-e-generative-ai.md` | 5 | lecture |

- [ ] **Step 1:** Create the two module dirs; `git mv "ai/attachments" "it/07-ai/attachments"`. (All 77 images live in the single course-level `attachments/`, shared across modules — basename resolution handles this regardless of which module a note sits in.)
- [ ] **Step 2:** Convert the 2 top-level notes (`1 - Introduzione` → lecture; `Domande e risposta` → `exam`).
- [ ] **Step 3:** Convert the 7 `2.x` notes into `02-ricerca-e-ragionamento/`.
- [ ] **Step 4:** Convert the 5 `3.x` notes into `03-machine-learning/`.
- [ ] **Step 5:** Author 3 `index.md`: top-level (`title: Intelligenza Artificiale`; description spanning agenti/ricerca/CSP/logica + ML/DL; overview pointing to the two modules and the intro lecture); `02-ricerca-e-ragionamento/index.md` (`title: Ricerca e Ragionamento`); `03-machine-learning/index.md` (`title: Machine Learning e Deep Learning`).
- [ ] **Step 6:** Remove emptied `ai/`.
- [ ] **Step 7:** Verify build; `ls app/build/it/ai/ricerca-e-ragionamento` and `.../machine-learning`; `grep -rl "#missing-" app/build/it/ai` empty.
- [ ] **Step 8:** Commit: `git add it/07-ai ai && git commit -m "content(ai): convert to it/07-ai with ricerca/ML modules"`.

---

## Task 7: Convert `data-mining` → `it/08-data-mining` (flat, English + Excalidraw)

Content is **English** — derive English titles/descriptions. Stays under `it/` for now (toggle is UI-only; spec §3.4).

**Files:**
- Move+rename notes; Move `data-mining/attachments/` → `it/08-data-mining/attachments/`; Move `data-mining/Excalidraw/` → `it/08-data-mining/Excalidraw/`
- Create: `it/08-data-mining/index.md`

**Mapping:**

| Source | Target slug | order | type |
|---|---|---|---|
| `1) Introduction.md` | `01-introduction.md` | 1 | lecture |
| `2) Data preparation.md` | `02-data-preparation.md` | 2 | lecture |
| `3) Similarity and distances.md` | `03-similarity-and-distances.md` | 3 | lecture |
| `4) Association mining.md` | `04-association-mining.md` | 4 | lecture |
| `5) Clustering analysis.md` | `05-clustering-analysis.md` | 5 | lecture |
| `6) Anomaly detection.md` | `06-anomaly-detection.md` | 6 | lecture |

- [ ] **Step 1:** `git mv "data-mining/attachments" "it/08-data-mining/attachments"`; `git mv "data-mining/Excalidraw" "it/08-data-mining/Excalidraw"` (1 scene, embedded via `![[Drawing 2025-04-09 12.08.27.excalidraw]]`).
- [ ] **Step 2:** Convert the 6 notes (English title + description; `type: lecture`).
- [ ] **Step 3:** Author `it/08-data-mining/index.md` (`title: Data Mining`; English description covering data prep, similarity, association mining, clustering, anomaly detection; overview).
- [ ] **Step 4:** Remove emptied `data-mining/`.
- [ ] **Step 5:** Verify build; `ls app/build/it/data-mining`; `grep -rl "#missing-" app/build/it/data-mining` empty; confirm the Excalidraw embed rendered.
- [ ] **Step 6:** Commit: `git add it/08-data-mining data-mining && git commit -m "content(data-mining): convert to it/08-data-mining (English) with Excalidraw"`.

---

## Task 8: Full-site integration verification

**Files:** none (verification + optional fixes).

- [ ] **Step 1:** Clean build: `cd app && npm run build`. Expect success; note the prerendered page count (should jump from fisica-only to all 8 courses).
- [ ] **Step 2:** Homepage shows all 8 courses in order: `grep -o 'href="/it/[a-z-]*"' app/build/it/index.html` (or inspect the built homepage) lists analisi, fisica, base-di-dati, statistica, algoritmica-avanzata, reti, ai, data-mining.
- [ ] **Step 3:** No unresolved embeds anywhere: `grep -rl "#missing-" app/build/it` is **empty**.
- [ ] **Step 4:** Every navigable folder has a non-empty title/description (no slug-fallback titles): spot-check each course's `index.html` hero. No note hero shows a raw `lezione-N`/`NN-` style title.
- [ ] **Step 5:** Visual spot-check via the preview MCP (`npm run preview`) in both themes: homepage grid, one modular course (ai or base-di-dati), one image-heavy lecture (analisi), one Excalidraw page (reti), one English page (data-mining). Confirm KaTeX, callouts, code, tables, images, and Excalidraw SVGs render.
- [ ] **Step 6:** Final commit if any fixes were made: `git add it && git commit -m "content: full-site conversion verification fixes"` (stage only `it/`; leave `app/` style WIP untouched). Then use **superpowers:finishing-a-development-branch**.

---

## Self-review notes (controller)

- **Spec coverage:** all 7 courses (§3.4 inventory) get frontmatter, filename normalization, `index.md`, module modeling (base-di-dati, ai), link/asset handling, and the `published`-by-default / `type` grouping (§3.2–3.3). `fisica` excluded (already done). ✓
- **No inter-note wikilinks** to rewrite (verified during survey) — only image/Excalidraw embeds (basename-resolved) and base-di-dati same-page anchors. ✓
- **Asset safety:** zero basename collisions across courses (verified), so embeds resolve after moving images under `it/`. ✓
- **Type consistency:** `NoteType = lecture|resource|exercise|exam|summary` matches `app/src/lib/content/types.ts`; `groupChildren` puts every non-`lecture` type under Resources. ✓
- **Right-sizing:** one task per course (independently buildable + reviewable); a final integration task. ✓
