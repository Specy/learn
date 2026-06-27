const PREFIX = /^(\d+)-(.+)$/;

export function stripMdExt(name: string): string {
  return name.replace(/\.md$/i, '');
}

export function parseEntryName(name: string): { order: number | null; slug: string } {
  const m = PREFIX.exec(name);
  if (m) return { order: Number(m[1]), slug: m[2] };
  return { order: null, slug: name };
}
