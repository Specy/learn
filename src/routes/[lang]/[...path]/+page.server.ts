import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { renderNode, listAllRoutes } from '$lib/content';
import { LANGUAGES } from '$lib/languages';
export const prerender = true;
export const entries: EntryGenerator = async () => listAllRoutes();
export const load: PageServerLoad = async ({ params }) => {
  if (!(params.lang in LANGUAGES)) error(404, 'Unknown language');
  try { return await renderNode(params.lang, params.path); }
  catch { error(404, 'Not found'); }
};
