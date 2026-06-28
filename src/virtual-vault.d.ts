declare module 'virtual:vault' {
	import type { RawFile } from '$lib/content/types';
	export const files: RawFile[];
	export const assets: Record<string, string>;
}
