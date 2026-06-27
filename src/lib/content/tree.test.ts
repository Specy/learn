// app/src/lib/content/tree.test.ts
import { describe, it, expect } from 'vitest';
import { buildTree, getNodeByPath, listRoutes, groupChildren, parseAuthors } from './tree';
import { effectiveAuthors } from './context';
import type { RawFile } from './types';

const files: RawFile[] = [
  { relPath: '02-fisica/index.md', frontmatter: { title: 'Fisica', description: 'Meccanica' }, content: 'overview' },
  { relPath: '02-fisica/01-intro.md', frontmatter: { title: 'Intro', description: 'd', type: 'lecture' }, content: 'a' },
  { relPath: '02-fisica/90-formulario.md', frontmatter: { title: 'Formulario', description: 'd', type: 'resource' }, content: 'b' },
  { relPath: '01-bdd/index.md', frontmatter: { title: 'Basi di Dati', description: 'd' }, content: 'o' },
  { relPath: '01-bdd/01-teoria/index.md', frontmatter: { title: 'Teoria', description: 'd' }, content: 'o' },
  { relPath: '01-bdd/01-teoria/01-intro.md', frontmatter: { title: 'T-Intro', description: 'd', type: 'lecture' }, content: 'c' },
  // an asset-only folder (NO index.md) must be ignored as a navigable node:
  { relPath: '01-bdd/attachments/note-only.md', frontmatter: {}, content: 'x' }
];

describe('buildTree', () => {
  const root = buildTree(files);

  it('orders courses by NN prefix', () => {
    expect(root.children.filter((c) => c.kind === 'folder').map((c) => c.slug))
      .toEqual(['bdd', 'fisica']);
  });

  it('strips prefixes for slugs and resolves by path', () => {
    const intro = getNodeByPath(root, ['fisica', 'intro']);
    expect(intro?.kind).toBe('note');
    expect(intro?.title).toBe('Intro');
  });

  it('treats a folder without index.md as non-navigable (asset store)', () => {
    expect(getNodeByPath(root, ['bdd', 'attachments'])).toBeNull();
  });

  it('groups children into modules and notes kept in order', () => {
    const fisica = getNodeByPath(root, ['fisica']) as any;
    const g = groupChildren(fisica);
    expect(g.modules).toEqual([]);
    // lecture (01-intro) and resource (90-formulario) interleaved in prefix order
    expect(g.notes.map((n: any) => n.slug)).toEqual(['intro', 'formulario']);
    // `all` mirrors the natural order for the unified list (no modules here)
    expect(g.all.map((n: any) => n.slug)).toEqual(['intro', 'formulario']);
  });

  it('keeps modules and notes interleaved by prefix in `all`', () => {
    const r = buildTree([
      { relPath: '01-c/index.md', frontmatter: { title: 'C' }, content: '' },
      { relPath: '01-c/01-intro.md', frontmatter: { title: 'Intro', type: 'lecture' }, content: '' },
      { relPath: '01-c/02-mod/index.md', frontmatter: { title: 'Mod' }, content: '' },
      { relPath: '01-c/03-outro.md', frontmatter: { title: 'Outro', type: 'lecture' }, content: '' }
    ]);
    const c = getNodeByPath(r, ['c']) as any;
    const g = groupChildren(c);
    expect(g.all.map((n: any) => `${n.kind}:${n.slug}`)).toEqual([
      'note:intro',
      'folder:mod',
      'note:outro'
    ]);
  });

  it('nests modules and lists every route prefix-stripped', () => {
    const paths = listRoutes(root).map((r) => r.path).sort();
    expect(paths).toContain('bdd/teoria');
    expect(paths).toContain('bdd/teoria/intro');
    expect(paths).not.toContain('bdd/attachments'); // not navigable
  });
});

describe('authors', () => {
  it('parseAuthors normalizes strings and objects, drops nameless/empty', () => {
    expect(parseAuthors(undefined)).toBeUndefined();
    expect(parseAuthors([])).toBeUndefined();
    expect(parseAuthors('Specy')).toEqual([{ name: 'Specy' }]);
    expect(parseAuthors([{ name: 'A', link: 'x', image: 'y' }, 'B'])).toEqual([
      { name: 'A', link: 'x', image: 'y' },
      { name: 'B' }
    ]);
    expect(parseAuthors([{ link: 'no-name' }])).toBeUndefined();
  });

  const authored: RawFile[] = [
    { relPath: '01-c/index.md', frontmatter: { title: 'C', authors: [{ name: 'Course' }] }, content: '' },
    { relPath: '01-c/01-m/index.md', frontmatter: { title: 'M', authors: [{ name: 'Module' }] }, content: '' },
    { relPath: '01-c/01-m/01-own.md', frontmatter: { title: 'Own', authors: [{ name: 'Lecture' }] }, content: '' },
    { relPath: '01-c/01-m/02-inherit.md', frontmatter: { title: 'Inherit' }, content: '' },
    { relPath: '01-c/02-bare/index.md', frontmatter: { title: 'Bare' }, content: '' },
    { relPath: '01-c/02-bare/01-deep.md', frontmatter: { title: 'Deep' }, content: '' }
  ];
  const aRoot = buildTree(authored);

  it('falls back lecture → module → course', () => {
    expect(effectiveAuthors(aRoot, 'c/m/own').map((a) => a.name)).toEqual(['Lecture']);
    expect(effectiveAuthors(aRoot, 'c/m/inherit').map((a) => a.name)).toEqual(['Module']);
    expect(effectiveAuthors(aRoot, 'c/bare/deep').map((a) => a.name)).toEqual(['Course']);
    expect(effectiveAuthors(aRoot, 'c/m').map((a) => a.name)).toEqual(['Module']);
    expect(effectiveAuthors(aRoot, 'c').map((a) => a.name)).toEqual(['Course']);
  });

  it('returns [] when nothing in the chain declares authors', () => {
    const root2 = buildTree([
      { relPath: '01-c/index.md', frontmatter: { title: 'C' }, content: '' },
      { relPath: '01-c/01-x.md', frontmatter: { title: 'X' }, content: '' }
    ]);
    expect(effectiveAuthors(root2, 'c/x')).toEqual([]);
  });
});
