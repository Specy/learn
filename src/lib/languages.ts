export type LanguageEntry = {
	label: string;
	/** Vault folder the content for this language is read from. */
	contentRoot: string;
	/**
	 * Set when this URL language serves another language's content unchanged. An aliased
	 * language stays routable for users, but its pages are noindex and canonicalize to the
	 * aliased language, and it is left out of the sitemap and hreflang. Remove the alias once
	 * the language has its own notes.
	 */
	aliasOf?: 'it';
};

export const LANGUAGES: Record<'it' | 'en', LanguageEntry> = {
	it: { label: 'Italiano', contentRoot: 'it' },
	en: { label: 'English', contentRoot: 'it', aliasOf: 'it' } // aliased until EN content exists
};
export type Lang = keyof typeof LANGUAGES;

/** Language used when a URL carries no recognised language segment. */
export const DEFAULT_LANG: Lang = 'it';

/** Whether a URL path segment names a language. */
export function isLang(segment: string | undefined): segment is Lang {
	return !!segment && Object.hasOwn(LANGUAGES, segment);
}

/** The language whose content a URL language actually shows (itself unless aliased). */
export function contentLang(lang: string): Lang {
	return isLang(lang) ? (LANGUAGES[lang].aliasOf ?? lang) : DEFAULT_LANG;
}

/** Languages that own their content and may appear in the sitemap and hreflang. */
export const INDEXABLE_LANGS = (Object.keys(LANGUAGES) as Lang[]).filter(
	(lang) => !LANGUAGES[lang].aliasOf
);
