import type { Handle } from '@sveltejs/kit';
import { DEFAULT_LANG, contentLang, isLang } from '$lib/languages';

/**
 * Writes the content language into the prerendered `<html lang>`. Crawlers and screen readers
 * read the server HTML before any script runs, so the client-side fix in SEO.svelte is not
 * enough on its own. An aliased URL language (en) takes the language of the content it shows.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const segment = event.url.pathname.split('/').filter(Boolean)[0];
	const lang = isLang(segment) ? contentLang(segment) : DEFAULT_LANG;
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
};
