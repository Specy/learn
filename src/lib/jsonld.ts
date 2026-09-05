import type { FolderLevel, NoteType } from './content/types';

const SITE_URL = 'https://learn.specy.app';

const AUTHOR = {
	'@type': 'Person',
	name: 'Specy',
	url: 'https://specy.app',
	sameAs: ['https://github.com/Specy']
} as const;

/** Every page belongs to the same vault; naming it once lets the graphs reference it. */
const PUBLISHER = {
	'@type': 'EducationalOrganization',
	'@id': `${SITE_URL}/#vault`,
	name: 'Specy — Appunti universitari',
	url: SITE_URL
} as const;

/**
 * `</script>` inside a JSON string would close the surrounding tag, and `<!--` opens a
 * comment. Escaping the three characters that can do that keeps the payload valid JSON
 * while making it inert as markup.
 */
export function serializeJsonLd(value: unknown) {
	return JSON.stringify(value)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026');
}

/**
 * The complete `<script type="application/ld+json">` element for a graph.
 *
 * Assembled here rather than in the component because a literal closing script tag inside
 * a Svelte template ends the component's own script block as far as the parser is
 * concerned. serializeJsonLd has already escaped < > and &, so nothing in `value` can
 * close the tag either.
 */
export function jsonLdScriptTag(value: unknown) {
	return `<script type="application/ld+json">${serializeJsonLd(value)}</` + `script>`;
}

function absolute(path: string) {
	return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * The trail Google renders in place of the raw URL in a result. The vault is several
 * levels deep (`cdl / course / module / note`), so without this a result shows a long
 * path instead of "Informatica › Analisi › Derivate".
 *
 * `breadcrumbs` holds the ancestors only, so the current page is appended as the last,
 * self-referencing item — the spec expects the full trail including the page itself.
 */
function breadcrumbLd(
	breadcrumbs: { title: string; url: string }[],
	current: { title: string; url: string }
) {
	const trail = [...breadcrumbs, current];
	return {
		'@type': 'BreadcrumbList',
		itemListElement: trail.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.title,
			item: absolute(crumb.url)
		}))
	};
}

/** Schema.org's own vocabulary for what a page teaches, keyed off the note's type. */
const LEARNING_RESOURCE_TYPE: Record<string, string> = {
	lecture: 'Lecture notes',
	resource: 'Reference material',
	exercise: 'Exercise',
	exam: 'Exam',
	summary: 'Summary'
};

/**
 * A page of the vault. Folders at course depth are a `Course`; everything else is a
 * `LearningResource`, which is the honest type for standalone notes — `Course` without
 * `hasCourseInstance` describes a programme nobody can enrol in.
 */
export function contentPageLd(opts: {
	kind: 'folder' | 'note';
	// Only the fields this graph reads: the page payload is a stripped node (no `children`),
	// so requiring a whole ContentNode here would not typecheck at the call site.
	node: { title: string; description?: string; level?: FolderLevel; type?: NoteType };
	lang: string;
	pathname: string;
	breadcrumbs: { title: string; url: string }[];
	authorNames?: string[];
}) {
	const { node, lang, pathname, breadcrumbs } = opts;
	const url = absolute(pathname);
	const isCourse = opts.kind === 'folder' && node.level === 'course';

	const authors = opts.authorNames?.length
		? opts.authorNames.map((name) => ({ '@type': 'Person', name }))
		: [AUTHOR];

	const main: Record<string, unknown> = {
		'@type': isCourse ? 'Course' : 'LearningResource',
		'@id': `${url}#main`,
		name: node.title,
		url,
		inLanguage: lang,
		isAccessibleForFree: true,
		provider: { '@id': PUBLISHER['@id'] },
		author: authors
	};

	if (node.description) main.description = node.description;
	if (opts.kind === 'note' && node.type) {
		const type = LEARNING_RESOURCE_TYPE[node.type];
		if (type) main.learningResourceType = type;
	}
	if (breadcrumbs.length) {
		main.isPartOf = { '@type': 'CreativeWork', name: breadcrumbs[breadcrumbs.length - 1].title };
	}

	return {
		'@context': 'https://schema.org',
		'@graph': [PUBLISHER, main, breadcrumbLd(breadcrumbs, { title: node.title, url: pathname })]
	};
}

/** The per-language index: who publishes the vault, and the degree programmes in it. */
export function languageIndexLd(opts: {
	lang: string;
	pathname: string;
	cdls: { title: string; description?: string; url: string }[];
}) {
	const url = absolute(opts.pathname);
	return {
		'@context': 'https://schema.org',
		'@graph': [
			PUBLISHER,
			{
				'@type': 'CollectionPage',
				'@id': `${url}#page`,
				url,
				inLanguage: opts.lang,
				isPartOf: { '@id': PUBLISHER['@id'] },
				mainEntity: {
					'@type': 'ItemList',
					itemListElement: opts.cdls.map((cdl, index) => ({
						'@type': 'ListItem',
						position: index + 1,
						name: cdl.title,
						item: absolute(cdl.url)
					}))
				}
			}
		]
	};
}

/** The site root, which exists to introduce the vault and pick a language. */
export function siteLd() {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			PUBLISHER,
			{
				'@type': 'WebSite',
				'@id': `${SITE_URL}/#website`,
				url: SITE_URL,
				name: 'Appunti universitari',
				publisher: { '@id': PUBLISHER['@id'] },
				inLanguage: ['it', 'en']
			},
			AUTHOR
		]
	};
}
