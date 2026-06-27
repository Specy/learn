// app/src/lib/content/context.ts
import { buildTree, getNodeByPath, listRoutes } from './tree';
import type { RawFile, FolderNode, NoteNode, Author } from './types';
import type { LinkResolver } from './markdown';

export interface Context { root: FolderNode; resolve: LinkResolver; }

function indexByTitleAndSlug(root: FolderNode) {
  const titleMap = new Map<string, NoteNode | FolderNode>();
  const slugMap = new Map<string, NoteNode | FolderNode>();
  const walk = (f: FolderNode) => {
    for (const c of f.children) {
      titleMap.set(c.title.toLowerCase(), c);
      slugMap.set(c.slug.toLowerCase(), c);
      if (c.kind === 'folder') walk(c);
    }
  };
  walk(root);
  return { titleMap, slugMap };
}

/** Prefix used to encode dual-theme excalidraw asset sentinels. */
export const EXCALIDRAW_SENTINEL_PREFIX = 'excalidraw:';

/** Encode a dual-theme excalidraw asset as a sentinel string for the embed handler. */
export function encodeExcalidrawSentinel(light: string | null, dark: string | null): string {
  return EXCALIDRAW_SENTINEL_PREFIX + JSON.stringify({ light, dark });
}

/** Decode an excalidraw sentinel, or return null if the string is not a sentinel. */
export function decodeExcalidrawSentinel(s: string): { light: string | null; dark: string | null } | null {
  if (!s.startsWith(EXCALIDRAW_SENTINEL_PREFIX)) return null;
  try {
    return JSON.parse(s.slice(EXCALIDRAW_SENTINEL_PREFIX.length));
  } catch {
    return null;
  }
}

export function makeResolver(root: FolderNode, assets: Record<string, unknown>): LinkResolver {
  const { titleMap, slugMap } = indexByTitleAndSlug(root);
  return {
    note(target: string) {
      const [name, anchor] = target.split('#');
      const key = name.trim().toLowerCase();
      const hit = titleMap.get(key) ?? slugMap.get(key);
      const base = hit ? hit.path : key.replace(/\s+/g, '-');
      return anchor ? `${base}#${anchor.trim().toLowerCase().replace(/\s+/g, '-')}` : base;
    },
    noteLabel(target: string) {
      const [name] = target.split('#');
      const key = name.trim().toLowerCase();
      const hit = titleMap.get(key) ?? slugMap.get(key);
      return hit ? hit.title : null;
    },
    asset(target: string) {
      const base = target.split('/').pop()!.trim();
      const entry = assets[base];

      // Excalidraw dual-theme asset: value is { light, dark }
      if (base.toLowerCase().endsWith('.excalidraw')) {
        if (entry && typeof entry === 'object' && entry !== null) {
          const { light, dark } = entry as { light: string | null; dark: string | null };
          return encodeExcalidrawSentinel(light, dark);
        }
        // Missing excalidraw: return a sentinel with no URLs so the embed
        // handler can still render a placeholder rather than a broken image.
        return encodeExcalidrawSentinel(null, null);
      }

      // Regular image/svg asset
      if (typeof entry === 'string') return entry;
      return `#missing-${base}`;
    }
  };
}

export function buildContext(files: RawFile[], assets: Record<string, unknown>): Context {
  const root = buildTree(files);
  return { root, resolve: makeResolver(root, assets) };
}

export function extractToc(html: string) {
  const out: { id: string; text: string; depth: number }[] = [];
  const re = /<h([2-4])[^>]*\bid="([^"]+)"[^>]*>(.*?)<\/h\1>/gis;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ depth: Number(m[1]), id: m[2], text: m[3].replace(/<[^>]+>/g, '').trim() });
  }
  return out;
}

export function siblings(root: FolderNode, notePath: string) {
  const segs = notePath.split('/');
  if (segs.length === 0) return { prev: null, next: null };

  const courseFolder = root.children.find(
    (c): c is FolderNode => c.kind === 'folder' && c.slug === segs[0]
  );

  const targetRoot = courseFolder || root;

  const list: NoteNode[] = [];
  const walk = (node: FolderNode | NoteNode) => {
    if (node.kind === 'note') {
      list.push(node);
    }
    if (node.kind === 'folder') {
      for (const child of node.children) {
        walk(child);
      }
    }
  };
  walk(targetRoot);

  const i = list.findIndex((n) => n.path === notePath);
  if (i === -1) return { prev: null, next: null };

  return {
    prev: i > 0 ? list[i - 1] : null,
    next: i < list.length - 1 ? list[i + 1] : null
  };
}


/**
 * Build the ancestor breadcrumb trail for a given path.
 * Returns one entry per ancestor folder (root → … → parent).
 * The current node itself is NOT included — callers render it as aria-current.
 *
 * @param root       The shared tree root.
 * @param path       The current node's path (e.g. "fisica/a" or "fisica").
 * @param lang       The language prefix used to build hrefs.
 * @param homeTitle  Optional label for the root/home crumb. Defaults to root.title or lang.
 */
export function breadcrumbsFor(
  root: FolderNode,
  path: string,
  lang: string,
  homeTitle?: string
): { title: string; url: string }[] {
  if (!path) return [];                       // root itself → no ancestors
  const segs = path.split('/');
  const result: { title: string; url: string }[] = [];

  // Walk every prefix except the full path (that is the current node)
  for (let i = 0; i < segs.length - 1; i++) {
    const prefixSegs = segs.slice(0, i + 1);
    const node = getNodeByPath(root, prefixSegs);
    const title = node ? node.title : prefixSegs[prefixSegs.length - 1];
    result.push({ title, url: `/${lang}/${prefixSegs.join('/')}` });
  }

  // Prepend the root/home crumb
  result.unshift({ title: homeTitle ?? (root.title || lang), url: `/${lang}` });
  return result;
}

/**
 * Authors for a page, with fallback: the node's own authors, else the nearest
 * ancestor (module → course) that declares any, else none. So a lecture inherits
 * its module's authors, a module inherits the course's, and the course shows its
 * own (or nothing).
 */
export function effectiveAuthors(root: FolderNode, path: string): Author[] {
  const segs = path ? path.split('/') : [];
  for (let i = segs.length; i >= 1; i--) {
    const node = getNodeByPath(root, segs.slice(0, i));
    if (node?.authors?.length) return node.authors;
  }
  return root.authors ?? [];
}

export { getNodeByPath, listRoutes };
