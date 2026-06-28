// src/lib/links.ts — external links used in the footer.

export const REPO_APP = 'https://github.com/Specy/learn';
export const REPO_NOTES = 'https://github.com/Specy/notes';
export const DONATE = 'https://ko-fi.com/specy';

/**
 * GitHub "edit" URL for a note's source file. `relPath` is relative to the
 * vault dir (notes/it), so the path within the notes repo is `it/<relPath>`.
 */
export function editUrl(relPath: string): string {
	return `${REPO_NOTES}/edit/main/${encodeURI(`it/${relPath}`)}`;
}
