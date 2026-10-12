import { describe, it, expect } from 'vitest';
import { canonicalPath, descriptionFromMarkdown, noteSeoTitle, splitLangPath } from './seo';
import { contentLang, INDEXABLE_LANGS } from './languages';

describe('descriptionFromMarkdown', () => {
	it('uses the first paragraph as plain text', () => {
		const md = '# Titolo\n\nLa **derivata** di una funzione è il [limite](https://x).\n\nAltro.';
		expect(descriptionFromMarkdown(md)).toBe('La derivata di una funzione è il limite.');
	});
	it('resolves wikilinks and drops callout headers', () => {
		const md = '> [!note] Nota\n> Vedi [[Limiti#intro|i limiti]] per dettagli.';
		expect(descriptionFromMarkdown(md)).toBe('Vedi i limiti per dettagli.');
	});
	it('cuts long text at a word boundary within 160 characters', () => {
		const out = descriptionFromMarkdown('parola '.repeat(60));
		expect(out.length).toBeLessThanOrEqual(160);
		expect(out.endsWith('…')).toBe(true);
		expect(out).not.toMatch(/par…$/);
	});
	it('returns an empty string for an empty body', () => {
		expect(descriptionFromMarkdown('  \n\n ')).toBe('');
	});
});

describe('noteSeoTitle', () => {
	it('appends the course name to a generic title', () => {
		expect(noteSeoTitle('Lezione 7', 'Algoritmica Avanzata')).toBe(
			'Lezione 7 · Algoritmica Avanzata'
		);
	});
	it('leaves titles that already name the course alone', () => {
		expect(noteSeoTitle('Algoritmica Avanzata: Lezione 7', 'Algoritmica Avanzata')).toBe(
			'Algoritmica Avanzata: Lezione 7'
		);
	});
	it('leaves the title alone without a course', () => {
		expect(noteSeoTitle('Formulario')).toBe('Formulario');
	});
});

describe('language aliasing', () => {
	it('maps the aliased en to it and excludes it from indexable languages', () => {
		expect(contentLang('en')).toBe('it');
		expect(contentLang('it')).toBe('it');
		expect(INDEXABLE_LANGS).toEqual(['it']);
	});
	it('canonicalizes paths onto the content language', () => {
		expect(canonicalPath('/en/fisica/a')).toBe('/it/fisica/a');
		expect(canonicalPath('/en')).toBe('/it');
		expect(canonicalPath('/it/fisica')).toBe('/it/fisica');
		expect(splitLangPath('/en/fisica')).toEqual({ segment: 'en', rest: '/fisica' });
	});
});
