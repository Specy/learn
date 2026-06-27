// app/src/lib/content/index.ts
import { files, assets } from 'virtual:vault';
import readingTime from 'reading-time';
import { buildContext, getNodeByPath, listRoutes, extractToc, siblings, breadcrumbsFor } from './context';
import { groupChildren } from './tree';
import { renderMarkdown } from './markdown';
import { toPlainText } from './plainText';
import { LANGUAGES } from '$lib/languages';
import { t } from '$lib/i18n';
import type { Context } from './context';

let _ctx: Context | null = null;
function ctx(): Context { return (_ctx ??= buildContext(files, assets)); }

export function listAllRoutes() {
  return (Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]).flatMap((lang) =>
    listRoutes(ctx().root).map((r) => ({ lang, path: r.path }))
  );
}


export async function renderNode(lang: string, path: string) {
  const c = ctx();
  const node = path === '' ? c.root : getNodeByPath(c.root, path.split('/'));
  if (!node) throw new Error(`404 ${lang}/${path}`);

  const breadcrumbs = breadcrumbsFor(c.root, node.path, lang, t(lang, 'nav.home'));

  // The shared resolver returns lang-relative note paths (e.g. "fisica/a").
  // Prepend the current /[lang]/ so wikilink hrefs are absolute and resolve
  // correctly from any page depth (and stay within the active language).
  const resolve = withLang(c.resolve, lang);

  if (node.kind === 'folder') {
    const html = node.content ? await renderMarkdown(node.content, resolve) : '';
    const g = groupChildren(node);
    const folderNode = { ...stripBody(node), image: node.image ? resolve.asset(node.image) : undefined };
    const sib = siblings(c.root, node.path);
    return {
      kind: 'folder' as const, lang,
      node: folderNode, html, groups: prefixGroups(g, lang, resolve), breadcrumbs,
      prev: sib.prev && { title: sib.prev.title, path: `/${lang}/${sib.prev.path}` },
      next: sib.next && { title: sib.next.title, path: `/${lang}/${sib.next.path}` }
    };
  }
  const html = await renderMarkdown(node.content, resolve);
  const stats = readingTime(toPlainText(node.content));
  const sib = siblings(c.root, node.path);
  const noteNode = {
    ...node,
    content: '',
    frontmatter: {
      ...node.frontmatter,
      image: node.frontmatter.image ? resolve.asset(node.frontmatter.image) : undefined
    }
  };
  return {
    kind: 'note' as const, lang,
    node: noteNode,
    html, toc: extractToc(html), readingText: stats.text,
    prev: sib.prev && { title: sib.prev.title, path: `/${lang}/${sib.prev.path}` },
    next: sib.next && { title: sib.next.title, path: `/${lang}/${sib.next.path}` },
    breadcrumbs
  };
}

/**
 * Wrap a lang-agnostic resolver so internal note links become absolute,
 * language-scoped hrefs (/[lang]/...). Assets and links that are already
 * absolute or pure anchors are passed through unchanged.
 */
export function withLang(resolve: Context['resolve'], lang: string): Context['resolve'] {
  return {
    asset: resolve.asset,
    noteLabel: resolve.noteLabel,
    note(target: string) {
      const href = resolve.note(target);
      if (href.startsWith('/') || href.startsWith('#') || href.startsWith('http')) return href;
      return `/${lang}/${href}`;
    }
  };
}

// helpers prefix child paths with /lang and drop heavy bodies for the payload
function stripBody(f: any) { return { ...f, content: '', children: undefined }; }
function prefixGroups(g: any, lang: string, resolve: Context['resolve']) {
  const map = (n: any) => ({ slug: n.slug, title: n.title, description: n.description,
    image: n.image ? resolve.asset(n.image) : undefined, type: n.type, url: `/${lang}/${n.path}` });
  return { modules: g.modules.map(map), lectures: g.lectures.map(map), resources: g.resources.map(map) };
}
