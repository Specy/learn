// app/src/lib/content/tree.test.ts
import { describe, it, expect } from 'vitest';
import { buildTree, getNodeByPath, listRoutes, groupChildren } from './tree';
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

  it('groups children into modules / lectures / resources', () => {
    const fisica = getNodeByPath(root, ['fisica']) as any;
    const g = groupChildren(fisica);
    expect(g.modules).toEqual([]);
    expect(g.lectures.map((n: any) => n.slug)).toEqual(['intro']);
    expect(g.resources.map((n: any) => n.slug)).toEqual(['formulario']);
  });

  it('nests modules and lists every route prefix-stripped', () => {
    const paths = listRoutes(root).map((r) => r.path).sort();
    expect(paths).toContain('bdd/teoria');
    expect(paths).toContain('bdd/teoria/intro');
    expect(paths).not.toContain('bdd/attachments'); // not navigable
  });
});
