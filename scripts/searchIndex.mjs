// @ts-nocheck
// scripts/searchIndex.mjs
//
// Pure, dependency-light builder for the client search index. Kept as plain ESM
// (like buildExcalidraw.mjs) so it is importable by the Vite plugin at build
// time AND unit-testable with vitest, with no TS transform step.
//
// It mirrors three rules from the app's TS so search URLs/anchors match the
// rendered pages exactly:
//   - prefix stripping     -> src/lib/content/slug.ts (parseEntryName)
//   - markdown -> text     -> src/lib/content/plainText.ts (toPlainText)
//   - heading anchor ids   -> rehype-slug, which uses github-slugger
import GithubSlugger from 'github-slugger';

const PREFIX = /^(\d+)-(.+)$/;

/** `NN-slug` -> `slug` (mirror of parseEntryName). */
export function stripPrefix(name) {
  const m = PREFIX.exec(name);
  return m ? m[2] : name;
}

/** Strip inline markdown from a single line (heading text / label). */
export function inlineText(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // links -> text
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/(\*\*|__)(.*?)\1/g, '$2')        // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')           // italic
    .replace(/\$([^$]+)\$/g, '$1')             // inline math
    .replace(/<[^>]+>/g, '')                   // html
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert markdown to plain text suitable for a search corpus.
 * Mirrors src/lib/content/plainText.ts toPlainText.
 */
export function mdToText(md) {
  return md
    .replace(/```[\s\S]*?```/g, '')                 // fenced code
    .replace(/^(?: {4}|\t).+$/gm, '')               // indented code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')           // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // links -> text
    .replace(/^#{1,6}\s+/gm, '')                    // heading hashes
    .replace(/(\*\*|__)(.*?)\1/g, '$2')             // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')               // italic
    .replace(/`[^`]+`/g, '')                        // inline code
    .replace(/^>\s*/gm, '')                         // blockquote markers
    .replace(/^[-*_]{3,}\s*$/gm, '')               // hr
    .replace(/<[^>]+>/g, '')                        // html
    .replace(/\$\$?([^$]*)\$\$?/g, '$1')           // math delimiters
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Split a note body into search sections.
 *
 * Returns the leading intro section ({heading:null, anchor:''}) followed by one
 * section per h1-h4 heading ({heading, anchor}). Many vault notes use `#` (h1)
 * for their actual sections, so h1 must be indexed (a leading title-repeat h1 is
 * folded into the file entry later, in buildSearchIndex). Every heading (h1-h6)
 * advances a single per-note GithubSlugger so duplicate-heading suffixes
 * (`-1`, `-2`) match rehype-slug exactly; h5/h6 fold into the surrounding
 * section. Sections with no heading and no text are dropped.
 */
export function splitSections(md) {
  const slugger = new GithubSlugger();
  const lines = md.split(/\r?\n/);
  let fenced = false;
  const sections = [];
  let current = { heading: null, anchor: '', lines: [] };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      current.lines.push(line);
      continue;
    }
    const h = !fenced && /^(#{1,6})\s+(.*\S)\s*$/.exec(line);
    if (h) {
      const depth = h[1].length;
      const text = inlineText(h[2]);
      const anchor = slugger.slug(text); // advance for ALL headings
      if (depth >= 1 && depth <= 4) {
        sections.push(current);
        current = { heading: text, anchor, lines: [] };
        continue;
      }
      // h5 / h6: keep as body of the current section.
      current.lines.push(line);
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  return sections
    .map((s) => ({ heading: s.heading, anchor: s.anchor, text: mdToText(s.lines.join('\n')) }))
    .filter((s) => s.heading !== null || s.text.length > 0);
}

/**
 * Build the flat search index from the vault's RawFile[] (relPath relative to
 * the vault dir, i.e. WITHOUT the language segment).
 *
 * Emits one `file` entry per note (title/description/intro) and one `section`
 * entry per h2-h4 heading. `index.md` files define folder/course metadata and
 * are not emitted as notes themselves. URLs are language-agnostic note paths;
 * the `/{lang}/` prefix is added at search time from the active context.
 */
export function buildSearchIndex(files) {
  // course slug -> display title, from "<course>/index.md"
  const courseTitle = {};
  for (const f of files) {
    const parts = f.relPath.split('/');
    if (parts.length === 2 && /^index\.md$/i.test(parts[1])) {
      const slug = stripPrefix(parts[0]);
      courseTitle[slug] = (f.frontmatter && f.frontmatter.title) || slug;
    }
  }

  const entries = [];
  let id = 0;

  for (const f of files) {
    const parts = f.relPath.split('/');
    const fileName = parts[parts.length - 1];
    if (/^index\.md$/i.test(fileName)) continue; // folder index, not a note

    const segs = parts.map(stripPrefix);
    segs[segs.length - 1] = stripPrefix(fileName.replace(/\.md$/i, ''));
    const notePath = segs.join('/');
    const course = segs.length > 1 ? segs[0] : '';
    const cTitle = course ? courseTitle[course] || course : '';

    const fm = f.frontmatter || {};
    const noteTitle = fm.title || segs[segs.length - 1];
    const description = fm.description || '';

    const sections = splitSections(f.content || '');
    const intro = sections.find((s) => s.heading === null);
    const headed = sections.filter((s) => s.heading !== null);

    // Fold a leading "# <Note Title>" heading (a title repeat) into the file
    // entry rather than emitting a redundant section for it.
    const norm = (x) => x.trim().toLowerCase();
    let introText = intro ? intro.text : '';
    let startIdx = 0;
    if (headed.length && norm(headed[0].heading) === norm(noteTitle)) {
      introText = [introText, headed[0].text].filter(Boolean).join(' ');
      startIdx = 1;
    }

    // One `file` entry: matched on title/filename + description + intro text.
    entries.push({
      id: id++,
      kind: 'file',
      course,
      courseTitle: cTitle,
      notePath,
      noteTitle,
      heading: null,
      anchor: '',
      text: [noteTitle, segs[segs.length - 1].replace(/-/g, ' '), description, introText]
        .filter(Boolean)
        .join(' — ')
    });

    // One `section` entry per h1-h4 heading (minus the folded title heading).
    for (let i = startIdx; i < headed.length; i++) {
      const s = headed[i];
      entries.push({
        id: id++,
        kind: 'section',
        course,
        courseTitle: cTitle,
        notePath,
        noteTitle,
        heading: s.heading,
        anchor: s.anchor,
        text: s.text
      });
    }
  }

  return entries;
}
