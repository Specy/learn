import it from './it.json';
import en from './en.json';
const DICTS: Record<string, Record<string, string>> = { it, en };
export function t(lang: string, key: string): string {
	return DICTS[lang]?.[key] ?? DICTS.it[key] ?? key;
}
