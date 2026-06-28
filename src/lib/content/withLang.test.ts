import { describe, it, expect } from 'vitest';
import { withLang } from './index';
import { buildContext } from './context';
import type { RawFile } from './types';

const files: RawFile[] = [
	{
		relPath: '02-fisica/index.md',
		frontmatter: { title: 'Fisica', description: 'd' },
		content: 'o'
	},
	{
		relPath: '02-fisica/01-a.md',
		frontmatter: { title: 'A', description: 'd', type: 'lecture' },
		content: 'x'
	},
	{
		relPath: '02-fisica/02-b.md',
		frontmatter: { title: 'B', description: 'd', type: 'lecture' },
		content: 'y'
	}
];

describe('withLang', () => {
	it('prepends /[lang]/ to internal (lang-relative) note hrefs', () => {
		const { resolve } = buildContext(files, {});
		const scoped = withLang(resolve, 'it');
		// resolve.note('A') -> 'fisica/a' (lang-relative); scoped -> '/it/fisica/a'
		expect(scoped.note('A')).toBe('/it/fisica/a');
	});

	it('keeps note hrefs within the active language', () => {
		const { resolve } = buildContext(files, {});
		expect(withLang(resolve, 'en').note('B')).toBe('/en/fisica/b');
	});

	it('preserves anchors when scoping note hrefs', () => {
		const { resolve } = buildContext(files, {});
		expect(withLang(resolve, 'it').note('A#intro')).toBe('/it/fisica/a#intro');
	});

	it('does not double-prefix already-absolute or anchor-only hrefs', () => {
		const passthrough = {
			note: (t: string) => t, // returns whatever it is given
			asset: (t: string) => t,
			noteLabel: (_t: string) => null
		};
		const scoped = withLang(passthrough, 'it');
		expect(scoped.note('/it/already/absolute')).toBe('/it/already/absolute');
		expect(scoped.note('#heading')).toBe('#heading');
		expect(scoped.note('https://example.com')).toBe('https://example.com');
	});

	it('passes assets through unchanged', () => {
		const { resolve } = buildContext(files, { 'img.png': '/vault-assets/img.1234abcd.png' });
		expect(withLang(resolve, 'it').asset('img.png')).toBe('/vault-assets/img.1234abcd.png');
	});
});
