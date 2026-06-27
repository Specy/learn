// app/src/lib/content/remarkObsidianLinks.test.ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

// Stub resolver: no label resolution (unresolved target falls back to raw slug)
const resolve = {
  note: (t: string) => `/note/${t}`,
  asset: (t: string) => `/vault-assets/${t}`,
  noteLabel: (_t: string) => null
};

// Resolver that returns a real title for a known target
const resolveWithLabel = {
  note: (t: string) => `/note/${t}`,
  asset: (t: string) => `/vault-assets/${t}`,
  noteLabel: (t: string) => t === 'terzo-principio-della-dinamica' ? 'Terzo principio della dinamica' : null
};

describe('obsidian links', () => {
  it('turns [[Target]] into a link via resolve.note', async () => {
    const html = await renderMarkdown('vedi [[L01]] qui', resolve);
    expect(html).toContain('href="/note/L01"');
    expect(html).toContain('>L01</a>');
  });
  it('uses the alias in [[Target|Alias]]', async () => {
    const html = await renderMarkdown('[[L01|Lezione 1]]', resolve);
    expect(html).toContain('href="/note/L01"');
    expect(html).toContain('>Lezione 1</a>');
  });
  it('turns ![[img.png]] into an image via resolve.asset', async () => {
    const html = await renderMarkdown('![[Pasted image 1.png]]', resolve);
    expect(html).toContain('src="/vault-assets/Pasted image 1.png"');
  });
  it('displays resolved note title for non-aliased wikilinks', async () => {
    const html = await renderMarkdown('[[terzo-principio-della-dinamica]]', resolveWithLabel);
    expect(html).toContain('href="/note/terzo-principio-della-dinamica"');
    expect(html).toContain('>Terzo principio della dinamica</a>');
  });
  it('alias overrides resolved title', async () => {
    const html = await renderMarkdown('[[terzo-principio-della-dinamica|My Alias]]', resolveWithLabel);
    expect(html).toContain('>My Alias</a>');
  });
  it('falls back to raw target when unresolved (no noteLabel match)', async () => {
    const html = await renderMarkdown('[[some-unknown-slug]]', resolveWithLabel);
    expect(html).toContain('href="/note/some-unknown-slug"');
    expect(html).toContain('>some-unknown-slug</a>');
  });
});
