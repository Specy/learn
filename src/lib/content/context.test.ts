// app/src/lib/content/context.test.ts
import { describe, it, expect } from 'vitest';
import { buildContext, extractToc, siblings, breadcrumbsFor } from './context';
import type { RawFile } from './types';

const files: RawFile[] = [
	{
		relPath: '01-fisica/index.md',
		frontmatter: { title: 'Fisica', description: 'd' },
		content: 'o'
	},
	{
		relPath: '01-fisica/01-a.md',
		frontmatter: { title: 'A', description: 'd', type: 'lecture' },
		content: 'x'
	},
	{
		relPath: '01-fisica/02-b.md',
		frontmatter: { title: 'B', description: 'd', type: 'lecture' },
		content: 'y'
	}
];

describe('context', () => {
	it('resolves a wikilink target by title to a node path', () => {
		const { resolve } = buildContext(files, {});
		expect(resolve.note('A')).toBe('fisica/a'); // route prepends /[lang]/
	});
	it('resolves an asset by basename', () => {
		const { resolve } = buildContext(files, { 'img.png': '/vault-assets/img.1234abcd.png' });
		expect(resolve.asset('img.png')).toBe('/vault-assets/img.1234abcd.png');
	});
	it('extracts a heading ToC from rendered html', () => {
		const toc = extractToc('<h2 id="uno">Uno</h2><h3 id="due">Due</h3>');
		expect(toc).toEqual([
			{ id: 'uno', text: 'Uno', depth: 2 },
			{ id: 'due', text: 'Due', depth: 3 }
		]);
	});
	it('finds prev/next siblings within a folder', () => {
		const { root } = buildContext(files, {});
		const { prev, next } = siblings(root, 'fisica/b');
		expect(prev?.slug).toBe('a');
		expect(next).toBeNull();
	});
	it('title map takes precedence over slug map when title and slug collide', () => {
		// Node A: file '01-a.md', title='Collision', slug='a' (from filename)
		// Node B: file '02-other.md', title='A', slug='other' (from filename)
		// titleMap: { 'collision' -> A, 'a' -> B }
		// slugMap:  { 'a' -> A, 'other' -> B }
		// Resolving 'a': titleMap.get('a') = B (title='A'), slugMap.get('a') = A (slug='a')
		// Title wins -> should return B's path 'fisica/other'
		const filesWithCollision: RawFile[] = [
			{
				relPath: '01-fisica/index.md',
				frontmatter: { title: 'Fisica', description: 'd' },
				content: 'o'
			},
			{
				relPath: '01-fisica/01-a.md',
				frontmatter: { title: 'Collision', description: 'd', type: 'lecture' },
				content: 'x'
			},
			{
				relPath: '01-fisica/02-other.md',
				frontmatter: { title: 'A', description: 'd', type: 'lecture' },
				content: 'z'
			}
		];
		const { resolve } = buildContext(filesWithCollision, {});
		// 'a' matches node B by title ('A'.toLowerCase() === 'a'), should win over node A's slug ('a')
		expect(resolve.note('a')).toBe('fisica/other');
	});
	it('siblings: first note has prev=null and next non-null', () => {
		const { root } = buildContext(files, {});
		const { prev, next } = siblings(root, 'fisica/a');
		expect(prev).toBeNull();
		expect(next?.slug).toBe('b');
	});
	it('breadcrumbsFor: root node (empty path) returns empty array', () => {
		const { root } = buildContext(files, {});
		expect(breadcrumbsFor(root, '', 'it')).toEqual([]);
	});
	it('breadcrumbsFor: top-level folder returns home crumb only', () => {
		const { root } = buildContext(files, {});
		// "fisica" is a top-level folder; ancestors = [home]
		expect(breadcrumbsFor(root, 'fisica', 'it')).toEqual([{ title: 'it', url: '/it' }]);
	});
	it('breadcrumbsFor: note inside folder returns home + folder crumbs', () => {
		const { root } = buildContext(files, {});
		const crumbs = breadcrumbsFor(root, 'fisica/a', 'it');
		expect(crumbs).toEqual([
			{ title: 'it', url: '/it' },
			{ title: 'Fisica', url: '/it/fisica' }
		]);
	});
	it('breadcrumbsFor: homeTitle overrides the default lang fallback for the home crumb', () => {
		const { root } = buildContext(files, {});
		const crumbs = breadcrumbsFor(root, 'fisica', 'it', 'Home');
		expect(crumbs).toEqual([{ title: 'Home', url: '/it' }]);
	});
	it('siblings: middle note has both prev and next non-null', () => {
		const filesWithThree: RawFile[] = [
			{
				relPath: '01-fisica/index.md',
				frontmatter: { title: 'Fisica', description: 'd' },
				content: 'o'
			},
			{
				relPath: '01-fisica/01-a.md',
				frontmatter: { title: 'A', description: 'd', type: 'lecture' },
				content: 'x'
			},
			{
				relPath: '01-fisica/02-b.md',
				frontmatter: { title: 'B', description: 'd', type: 'lecture' },
				content: 'y'
			},
			{
				relPath: '01-fisica/03-c.md',
				frontmatter: { title: 'C', description: 'd', type: 'lecture' },
				content: 'z'
			}
		];
		const { root } = buildContext(filesWithThree, {});
		const { prev, next } = siblings(root, 'fisica/b');
		expect(prev?.slug).toBe('a');
		expect(next?.slug).toBe('c');
	});
});
