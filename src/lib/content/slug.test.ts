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
