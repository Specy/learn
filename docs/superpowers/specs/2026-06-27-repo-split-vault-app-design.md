# Repo split: content vault + app — design & migration runbook

**Date:** 2026-06-27

**Goal:** Split the single `Specy/notes` repo (which today holds both the Obsidian
vault and the SvelteKit site) into two repos:

- **`Specy/notes`** — the pure content vault (Obsidian).
- **`Specy/learn`** — the SvelteKit app, consuming `notes` as a git **submodule**.

## Decisions (locked)

1. **learn layout:** the app lives at the **repo root** of `learn`; the `notes`
   submodule mounts at `learn/notes/`. `VAULT_DIR` → `notes/it`.
2. **App history:** **fresh start** in `learn` (the app's past history remains in
   the `notes` repo history, where it was developed).
3. **Vault contents:** `notes` keeps `it/`, `Excalidraw/`, `.gitignore`,
   `LICENSE`, and a short rewritten README. `app/` and `docs/` move to `learn`;
   `.superpowers/` is dropped.
4. **learn working copy on disk:** `C:\Users\specy\Desktop\progetti\learn`. The
   vault stays at `C:\Users\specy\Desktop\notes` (the Obsidian vault).

## Target structure

```
Specy/notes   (Desktop\notes — Obsidian vault)
├─ it/                 # content root (future: en/)
├─ Excalidraw/         # Obsidian default drawing folder (vault-only)
├─ .gitignore
├─ LICENSE
└─ README.md           # short: "content vault for learn.specy.app"

Specy/learn   (Desktop\progetti\learn)
├─ src/  static/  scripts/        # the SvelteKit app, at root
├─ package.json (name: "learn")  svelte.config.js  vite.config.js
├─ vite-plugin-vault.js
├─ docs/                          # moved from notes
├─ notes/                         # git submodule → Specy/notes
├─ .gitmodules
├─ .gitignore
└─ README.md                      # full project README (adapted)
```

## Vault-path coupling (the only code change)

`VAULT_DIR` is centralized; repoint it from the sibling `../it` to the submodule
`notes/it` in three files (app now at learn root):

- `vite-plugin-vault.js`: `path.resolve(__dirname, '..', 'it')` → `path.resolve(__dirname, 'notes', 'it')`
- `vite.config.js`: same root change; `server.fs.allow` set to allow the submodule path
- `scripts/buildExcalidraw.mjs`: `path.resolve(__dirname, '..', '..', 'it')` → `path.resolve(__dirname, '..', 'notes', 'it')`

The Excalidraw prebuild only reads `*.excalidraw.md` **inside `it/`**; the root
`Excalidraw/` folder is Obsidian-only and is not consumed by the build.

## Migration runbook (sequential — execute in order)

**Phase 1 — Seed `learn` from the current working tree (captures uncommitted WIP)**
1. Create `Desktop\progetti\learn`.
2. Copy `app/` working tree → `learn/` root, excluding `node_modules`,
   `.svelte-kit`, `build`, `static/vault-assets`. (This carries the user's
   uncommitted app edits.)
3. Copy `docs/` → `learn/docs/`.

**Phase 2 — Reduce `notes` to the vault and push**
4. `git rm -rf app docs .superpowers` in notes.
5. Rewrite `notes/README.md` to the short vault README.
6. Commit (scoped) and **push** `notes` to `origin` (so the submodule can pull
   the latest vault, including the analisi split).

**Phase 3 — Wire up `learn`**
7. `git init` in `learn`; `git submodule add https://github.com/Specy/notes notes`.
8. Repoint `VAULT_DIR` (3 files); rename `package.json` `name` → `learn`; adapt
   README; ensure `.gitignore` is correct (submodule not ignored).
9. `npm install && npm run build` — verify the site prerenders reading content
   from `notes/it` (no missing embeds; analisi + all courses render).
10. Initial commit; `git remote add origin https://github.com/Specy/learn`;
    force-push `main` (replacing the placeholder README).

## Verification

- `learn` build produces `build/` with all courses prerendered and **zero**
  missing-embed markers, reading from the submodule.
- `notes` contains only vault content; `git ls-files` shows no `app/`.

## Follow-ups (flag, don't silently do)

- **Deployment:** no CI lives in the repo — the host is configured platform-side.
  Repoint it `notes`→`learn`, enable submodule checkout, build `npm run build`,
  publish `build/`. Content workflow: edit notes in Obsidian → push → in `learn`
  `git submodule update --remote notes && git commit`.
- **specy.app `Projects.ts`:** the "Learn" card's GitHub link points to `notes`;
  switching it to `learn` is appropriate but requires asking before touching the
  specy.app repo.
