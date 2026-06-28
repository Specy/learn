// scripts/searchIndex.test.mjs
import { describe, it, expect } from 'vitest';
import GithubSlugger from 'github-slugger';
import {
	stripPrefix,
	inlineText,
	mdToText,
	splitSections,
	buildSearchIndex
} from './searchIndex.mjs';

describe('stripPrefix', () => {
	it('strips a numeric NN- prefix', () => {
		expect(stripPrefix('01-analisi')).toBe('analisi');
		expect(stripPrefix('12-foo-bar')).toBe('foo-bar');
	});
	it('leaves un-prefixed names untouched', () => {
		expect(stripPrefix('analisi')).toBe('analisi');
		expect(stripPrefix('index')).toBe('index');
	});
});

describe('inlineText', () => {
	it('strips inline markdown markers but keeps the words', () => {
		expect(inlineText('Criterio del **rapporto**')).toBe('Criterio del rapporto');
		expect(inlineText('A `code` and [link](/x) and $x^2$')).toBe('A code and link and x^2');
	});
});

describe('mdToText', () => {
	it('removes code fences, headings and markup', () => {
		const md = '# Title\n\nSome **bold** text.\n\n```js\nconst x = 1;\n```\n\n> quote';
		const out = mdToText(md);
		expect(out).toContain('Some bold text.');
		expect(out).not.toContain('const x');
		expect(out).not.toContain('#');
		expect(out).not.toContain('>');
	});
});

describe('splitSections', () => {
	it('produces one section per h1-h4 heading, with github-slugger anchors', () => {
		const md = [
			'# Lecture Title',
			'intro paragraph',
			'## Tipi di successioni',
			'body a',
			'### Sub heading',
			'body b',
			'## Forme indeterminate',
			'body c'
		].join('\n');
		const secs = splitSections(md);
		// h1 is now a section (many notes use # for real sections)
		expect(secs.map((s) => s.heading)).toEqual([
			'Lecture Title',
			'Tipi di successioni',
			'Sub heading',
			'Forme indeterminate'
		]);
		expect(secs[0].anchor).toBe('lecture-title');
		expect(secs[0].text).toContain('intro paragraph');
		expect(secs[1].anchor).toBe('tipi-di-successioni');
		expect(secs[2].anchor).toBe('sub-heading');
	});

	it('keeps content before the first heading as a null-heading intro section', () => {
		const secs = splitSections('lead text here\n\n## First\nbody');
		expect(secs[0].heading).toBe(null);
		expect(secs[0].text).toContain('lead text here');
		expect(secs[1].heading).toBe('First');
	});

	it('matches rehype-slug duplicate-suffix behaviour via a shared slugger', () => {
		const md = '## Foo\nx\n## Foo\ny\n### Foo\nz';
		const secs = splitSections(md).filter((s) => s.heading);
		expect(secs.map((s) => s.anchor)).toEqual(['foo', 'foo-1', 'foo-2']);
	});

	it('keeps the slugger counter in sync across heading levels (h1 included)', () => {
		// The h1 "Foo" consumes `foo`, so the h2 "Foo" must become `foo-1`,
		// exactly as rehype-slug (which ids every heading) would render it.
		const secs = splitSections('# Foo\n## Foo\nbody').filter((s) => s.heading);
		expect(secs.map((s) => s.anchor)).toEqual(['foo', 'foo-1']);
	});

	it('does not treat # inside code fences as headings', () => {
		const md = '## Real\n```\n## not a heading\n```\nbody';
		const secs = splitSections(md).filter((s) => s.heading);
		expect(secs.map((s) => s.heading)).toEqual(['Real']);
	});

	it('handles emoji and accented Italian headings', () => {
		const md = '## 🟢 Successione monotonà\nbody';
		const sec = splitSections(md).find((s) => s.heading);
		const expected = new GithubSlugger().slug(inlineText('🟢 Successione monotonà'));
		expect(sec.anchor).toBe(expected);
	});
});

describe('buildSearchIndex', () => {
	const files = [
		{
			relPath: '01-analisi/index.md',
			frontmatter: { title: 'Analisi Matematica' },
			content: '# Analisi'
		},
		{
			// leading "# Serie e Successioni" repeats the title -> folds into the file entry
			relPath: '01-analisi/01-serie.md',
			frontmatter: { title: 'Serie e Successioni', description: 'Criteri di convergenza' },
			content:
				'# Serie e Successioni\nintro\n## Tipi di successioni\nuna successione\n## Convergenza\nassoluta'
		},
		{
			// h1-structured note (no title repeat): h1 headings must become sections
			relPath: '02-fisica/01-intro.md',
			frontmatter: { title: 'Introduzione' },
			content: '# Termodinamica\ncalore\n# Cinematica\nmoto'
		}
	];

	it('emits a file entry per note and a section per h1-h4 heading', () => {
		const entries = buildSearchIndex(files);
		const fileE = entries.filter((e) => e.kind === 'file');
		const sections = entries.filter((e) => e.kind === 'section');
		expect(fileE.map((e) => e.noteTitle).sort()).toEqual(['Introduzione', 'Serie e Successioni']);
		expect(sections.map((e) => e.heading).sort()).toEqual([
			'Cinematica',
			'Convergenza',
			'Termodinamica',
			'Tipi di successioni'
		]);
	});

	it('folds a leading title-repeat h1 into the file entry (no redundant section)', () => {
		const entries = buildSearchIndex(files);
		expect(entries.some((e) => e.kind === 'section' && e.heading === 'Serie e Successioni')).toBe(
			false
		);
		const serie = entries.find((e) => e.kind === 'file' && e.noteTitle === 'Serie e Successioni');
		expect(serie.text).toContain('intro'); // folded lead content present
	});

	it('indexes h1 headings as sections for h1-structured notes', () => {
		const entries = buildSearchIndex(files);
		const termo = entries.find((e) => e.kind === 'section' && e.heading === 'Termodinamica');
		expect(termo).toBeTruthy();
		expect(termo.notePath).toBe('fisica/intro');
		expect(termo.anchor).toBe('termodinamica');
	});

	it('does not emit index.md as a note', () => {
		const entries = buildSearchIndex(files);
		expect(entries.some((e) => e.notePath === 'analisi')).toBe(false);
	});

	it('derives course, courseTitle and prefix-stripped notePath', () => {
		const entries = buildSearchIndex(files);
		const serie = entries.find((e) => e.kind === 'file' && e.noteTitle === 'Serie e Successioni');
		expect(serie.notePath).toBe('analisi/serie');
		expect(serie.course).toBe('analisi');
		expect(serie.courseTitle).toBe('Analisi Matematica');
	});

	it('file entry text includes title, description and intro for filename matching', () => {
		const entries = buildSearchIndex(files);
		const serie = entries.find((e) => e.kind === 'file' && e.noteTitle === 'Serie e Successioni');
		expect(serie.text).toContain('Serie e Successioni');
		expect(serie.text).toContain('Criteri di convergenza');
		expect(serie.text).toContain('intro');
	});

	it('assigns unique sequential ids', () => {
		const entries = buildSearchIndex(files);
		const ids = entries.map((e) => e.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
