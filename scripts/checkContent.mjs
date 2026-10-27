// scripts/checkContent.mjs — validate the notes vault before/after editing it.
//
//   npm run check:content                    report problems (exit 1 on errors)
//   npm run check:content -- --delete-orphans also delete unreferenced images
//
// Errors (fail the run):
//   - math KaTeX can't render (it would show as red source on the site)
//   - ```plot fences that don't render
//   - ```mermaid fences with a syntax error
//   - ![[embeds]] of images / excalidraw drawings that don't exist
// Warnings:
//   - images no note references any more (left behind after replacing a
//     screenshot with LaTeX / a plot / mermaid)
//   - mermaid diagrams that can only be validated in a browser
import { readdir, readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { runnerImport } from 'vite';
import { walkMd } from '../vite-plugin-vault.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTES = path.join(ROOT, 'notes');
const CONTENT = path.join(NOTES, 'it');
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const deleteOrphans = process.argv.includes('--delete-orphans');

if (!existsSync(CONTENT)) {
	console.error(`notes not found at ${CONTENT} — run: git submodule update --init`);
	process.exit(1);
}

async function walkImages(dir, out = []) {
	for (const e of await readdir(dir, { withFileTypes: true })) {
		if (e.name.startsWith('.')) continue;
		const abs = path.join(dir, e.name);
		if (e.isDirectory()) await walkImages(abs, out);
		else if (IMAGE_EXTS.has(path.extname(e.name).toLowerCase())) out.push(abs);
	}
	return out;
}

/** Line in the original file for a line in the normalizeBlockMath output. */
function lineMapper(content, offset) {
	const map = [];
	content.split('\n').forEach((line, i) => {
		const n = /^[ \t]*\$\$[ \t]*([^\n]+?)[ \t]*\$\$[ \t]*$/.test(line) ? 3 : 1;
		for (let k = 0; k < n; k++) map.push(i + 1 + offset);
	});
	return (line) => (line ? (map[line - 1] ?? line + offset) : '?');
}

const { module: markdown } = await runnerImport(path.join(ROOT, 'src/lib/content/markdown.ts'), {
	configFile: false,
	root: ROOT,
	logLevel: 'error'
});
const { default: mermaid } = await import('mermaid');

const images = await walkImages(NOTES);
const imageNames = new Set(images.map((p) => path.basename(p)));
const allMd = await walkMd(NOTES);
const notes = allMd.filter((f) => f.absPath.startsWith(CONTENT + path.sep));
// Drawings live in any Excalidraw/ folder; embeds name them without the .md.
const drawings = new Set(
	allMd
		.map((f) => path.basename(f.absPath))
		.filter((n) => n.endsWith('.excalidraw.md'))
		.map((n) => n.slice(0, -3))
);

const errors = [];
const warnings = [];
let unverifiedMermaid = 0;
let corpus = '';

for (const { absPath } of allMd) {
	const raw = (await readFile(absPath, 'utf-8')).replace(/\r\n/g, '\n');
	corpus += raw + '\n';
	try {
		corpus += decodeURIComponent(raw) + '\n'; // ![](Pasted%20image.png)
	} catch {
		// not URI-decodable as a whole; the raw text is enough
	}
}

for (const { absPath } of notes) {
	const rel = path.relative(ROOT, absPath);
	const raw = (await readFile(absPath, 'utf-8')).replace(/\r\n/g, '\n');
	const { content } = matter(raw);
	const offset = raw.slice(0, raw.length - content.length).split('\n').length - 1;
	const toLine = lineMapper(content, offset);

	const missing = [];
	const resolve = {
		note: (t) => `/${t}`,
		noteLabel: () => null,
		asset(target) {
			const base = target.split('/').pop().trim();
			const ext = path.extname(base).toLowerCase();
			if (ext === '.excalidraw') {
				if (!drawings.has(base)) missing.push(base);
			} else if (IMAGE_EXTS.has(ext) && !imageNames.has(base)) missing.push(base);
			return `/vault-assets/${base}`;
		}
	};

	// KaTeX reports LaTeX-incompatible input on console.warn. Accented letters in
	// math render fine, but \\ in display math silently drops the line break.
	const strict = new Set();
	const warn = console.warn;
	console.warn = (msg) => {
		if (!String(msg).includes('unicodeTextInMathMode'))
			strict.add(String(msg).replace(/^.*?: /, ''));
	};
	const file = await markdown
		.createProcessor(resolve)
		.process(markdown.normalizeBlockMath(content))
		.finally(() => (console.warn = warn));
	for (const msg of strict) warnings.push(`${rel}  KaTeX: ${msg}`);
	for (const m of file.messages) {
		const reason = m.cause instanceof Error ? `KaTeX: ${m.cause.message}` : m.reason;
		errors.push(`${rel}:${toLine(m.line)}  ${reason}`);
	}
	for (const name of missing) errors.push(`${rel}  missing embed: ${name}`);

	const fence = /^```mermaid[ \t]*\n([\s\S]*?)^```/gm;
	for (const m of content.matchAll(fence)) {
		const line = content.slice(0, m.index).split('\n').length + offset;
		try {
			await mermaid.parse(m[1]);
		} catch (e) {
			const msg = String(e?.message ?? e);
			// Some diagram types sanitise labels with DOMPurify, which needs a DOM.
			if (msg.includes('DOMPurify')) unverifiedMermaid++;
			else errors.push(`${rel}:${line}  mermaid: ${msg.split('\n').slice(0, 3).join(' ')}`);
		}
	}
}

const orphans = images.filter((p) => !corpus.includes(path.basename(p)));
for (const p of orphans) {
	if (deleteOrphans) await unlink(p);
	warnings.push(
		`${path.relative(ROOT, p)}  ${deleteOrphans ? 'deleted (unreferenced)' : 'unreferenced image'}`
	);
}
if (unverifiedMermaid)
	warnings.push(
		`${unverifiedMermaid} mermaid diagram(s) need a browser to validate — check them with npm run dev`
	);

for (const w of warnings) console.log(`warn   ${w}`);
for (const e of errors) console.log(`error  ${e}`);
console.log(
	`\nchecked ${notes.length} notes, ${images.length} images: ${errors.length} error(s), ${warnings.length} warning(s)` +
		(orphans.length && !deleteOrphans
			? ' — rerun with --delete-orphans to remove unreferenced images'
			: '')
);
process.exit(errors.length ? 1 : 0);
