export type NoteType = 'lecture' | 'resource' | 'exercise' | 'exam' | 'summary';

export interface RawFile {
  relPath: string;                         // POSIX, e.g. '02-fisica/01-intro.md'
  frontmatter: Record<string, any>;
  content: string;
}
export interface NoteNode {
  kind: 'note';
  slug: string;                            // prefix-stripped, no ext
  path: string;                            // full url path, e.g. 'fisica/intro'
  relPath: string;                         // source path in the vault, e.g. '02-fisica/01-intro.md'
  order: number;
  title: string;
  description: string;
  type: NoteType;
  published: boolean;
  content: string;                         // raw markdown body
  frontmatter: Record<string, any>;
}
export interface FolderNode {
  kind: 'folder';
  slug: string;
  path: string;
  relPath?: string;                        // source index.md path (undefined for the synthetic root)
  order: number;
  title: string;
  description: string;
  image?: string;
  published: boolean;
  content: string;                         // index.md body
  children: ContentNode[];
}
export type ContentNode = FolderNode | NoteNode;
