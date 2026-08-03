import { describe, it, expect } from 'vitest';
import { t } from './index';
import { LANGUAGES } from '../languages';
describe('i18n', () => {
	it('returns the localized string', () => {
		expect(t('it', 'nav.home')).toBe('Home');
	});
	it('falls back to it then the key', () => {
		expect(t('en', 'nav.home')).toBe(t('it', 'nav.home')); // en aliases it copy if missing
		expect(t('it', 'does.not.exist')).toBe('does.not.exist');
	});
	it('interpolates {name} placeholders', () => {
		expect(t('it', 'tag.year', { n: 2 })).toBe('2° anno');
		expect(t('en', 'tag.year', { n: 2 })).toBe('Year 2');
	});
	it('leaves an unmatched placeholder untouched', () => {
		expect(t('it', 'tag.year', { other: 1 })).toBe('{n}° anno');
	});
	it('aliases en content root to it for now', () => {
		expect(LANGUAGES.en.contentRoot).toBe('it');
	});
});
