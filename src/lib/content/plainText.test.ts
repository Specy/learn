// app/src/lib/content/plainText.test.ts
import { describe, it, expect } from 'vitest';
import { toPlainText } from './plainText';
describe('toPlainText', () => {
	it('strips code, images and markdown punctuation', () => {
		const out = toPlainText('# Title\n\n```js\nx\n```\n\n![a](b) **bold** [t](u)');
		expect(out).not.toContain('```');
		expect(out).toContain('Title');
		expect(out).toContain('bold');
		expect(out).toContain('t'); // link text kept
		expect(out).not.toContain('(u)'); // link url dropped
	});
});
