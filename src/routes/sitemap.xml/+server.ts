import { listAllRoutes } from '$lib/content';
import { LANGUAGES } from '$lib/languages';

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
	const langs = Object.keys(LANGUAGES);

	// Every content path exists under each language, and SEO.svelte cross-declares them
	// with hreflang. Mirroring those alternates here is what lets Google serve the right
	// language variant rather than picking one and treating the rest as duplicates.
	const paths = [
		{ loc: '/', alternates: [] as { lang: string; href: string }[] },
		...langs.map((lang) => ({
			loc: `/${lang}`,
			alternates: langs.map((l) => ({ lang: l, href: `${SITE_URL}/${l}` }))
		})),
		...routes.map((route) => ({
			loc: `/${route.lang}/${route.path}`,
			alternates: langs.map((l) => ({
				lang: l,
				href: `${SITE_URL}/${l}/${route.path}`
			}))
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
