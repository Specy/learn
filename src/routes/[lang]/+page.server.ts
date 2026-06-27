import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { renderNode } from '$lib/content';
import { LANGUAGES } from '$lib/languages';
export const prerender = true;
export const entries: EntryGenerator = () => Object.keys(LANGUAGES).map((lang) => ({ lang }));
export const load: PageServerLoad = async ({ params }) => {
  if (!(params.lang in LANGUAGES)) error(404, 'Unknown language');
  const data = await renderNode(params.lang, '');
  return { lang: params.lang, courses: data.kind === 'folder' ? data.groups.modules : [] };
};
