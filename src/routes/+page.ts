import { listAllRoutes } from '$lib/content';
import { LANGUAGES } from '$lib/languages';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async () => {
	// Course counts give the landing page something concrete to say about the vault
	// instead of a bare language picker.
	const routes = await listAllRoutes();
	const perLang = Object.fromEntries(
		Object.keys(LANGUAGES).map((lang) => [
			lang,
			routes.filter((r) => r.lang === lang).length
		])
	) as Record<string, number>;
	return { perLang };
};
