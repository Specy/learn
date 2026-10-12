import { listAllRoutes } from '$lib/content';
import { INDEXABLE_LANGS } from '$lib/languages';

export const prerender = true;

const SITE_URL = 'https://learn.specy.app';

/** Not legal as-is in XML character data. Note titles reach these URLs as slugs, so an
 *  `&` is entirely possible and would otherwise produce a document search engines reject. */
function escapeXml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET = async () => {
	const routes = await listAllRoutes();

	// Only languages with their own content are listed. Aliased languages (e.g. en, which serves
	// the Italian notes) are noindex and canonicalize to /it, so they stay out of the sitemap.
	// Each indexable URL is cross-declared with hreflang for every indexable language, which lets
	// Google serve the right language variant rather than treating the copies as duplicates.
	const alternatesFor = (path: string) =>
		INDEXABLE_LANGS.map((l) => ({ lang: l, href: `${SITE_URL}/${l}${path}` }));
	const paths = [
		{ loc: '/', alternates: [] as { lang: string; href: string }[] },
		...INDEXABLE_LANGS.map((lang) => ({ loc: `/${lang}`, alternates: alternatesFor('') })),
		...routes
			.filter((route) => INDEXABLE_LANGS.includes(route.lang))
			.map((route) => ({
				loc: `/${route.lang}/${route.path}`,
				alternates: alternatesFor(`/${route.path}`)
			}))
	];

	const buildDate = new Date().toISOString().slice(0, 10);

	const entries = paths.map(({ loc, alternates }) => {
		const alts = alternates
			.map(
				(a) =>
					`\n\t\t<xhtml:link rel="alternate" hreflang="${escapeXml(a.lang)}" href="${escapeXml(a.href)}"/>`
			)
			.join('');
		return `\t<url>
\t\t<loc>${escapeXml(SITE_URL + loc)}</loc>
\t\t<lastmod>${buildDate}</lastmod>${alts}
\t</url>`;
	});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>`;

	return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
