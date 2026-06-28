export const LANGUAGES = {
	it: { label: 'Italiano', contentRoot: 'it' },
	en: { label: 'English', contentRoot: 'it' } // aliased until EN content exists
} as const;
export type Lang = keyof typeof LANGUAGES;
