import it from './it.json';
import en from './en.json';
const DICTS: Record<string, Record<string, string>> = { it, en };
/**
 * Look up a localized string, falling back to Italian and then to the key.
 * `{name}` placeholders are filled from `params`; a placeholder with no matching
 * param is left untouched.
 */
export function t(lang: string, key: string, params?: Record<string, string | number>): string {
	const raw = DICTS[lang]?.[key] ?? DICTS.it[key] ?? key;
	if (!params) return raw;
	return raw.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}
