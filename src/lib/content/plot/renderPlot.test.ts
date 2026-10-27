import { describe, it, expect } from 'vitest';
import { renderPlot } from './renderPlot';
import { renderMarkdown } from '../markdown';

const resolve = {
	note: (t: string) => `/${t}`,
	asset: (t: string) => `/vault-assets/${t}`,
	noteLabel: (_t: string) => null
};

describe('renderPlot', () => {
	it('renders curves, theme colours and KaTeX labels', () => {
		const html = renderPlot(
			[
				'x: [0, 3]',
				'y: [0, 3]',
				'items:',
				'  - fn: f(x) = sqrt(x)',
				'    color: blue',
				'    label: $f$'
			].join('\n'),
			'p1'
		);
		expect(html).toContain('<figure class="plot">');
		expect(html).toContain('stroke:var(--palette-blue)');
		expect(html).toContain('class="katex"');
		expect(html).toContain('clipPath id="p1"');
	});
	it('lets items reference functions and let-bindings by name', () => {
		const html = renderPlot(
			[
				'x: [0, 3]',
				'y: [0, 3]',
				'let: { a: 1 }',
				'items:',
				"  - fn: t(x) = f(a) + f'(a)(x - a)",
				'  - fn: f(x) = x^2 / 2',
				'  - point: [a, f(a)]'
			].join('\n'),
			'p2'
		);
		// f(1) = 0.5 → y pixel = 300 - 0.5/3*300 = 250
		expect(html).toContain('cy="250"');
	});
	it('colours a signed area by sign', () => {
		const html = renderPlot(
			'x: [0, 7]\ny: [-2, 2]\nitems:\n  - area: sin(x)\n    signed: true',
			'p3'
		);
		expect(html).toContain('fill:var(--palette-green)');
		expect(html).toContain('fill:var(--palette-red)');
	});
	it('throws on invalid specs', () => {
		expect(() => renderPlot('items:\n  - wobble: 1', 'p')).toThrow(/item needs one of/);
		expect(() => renderPlot('items:\n  - fn: x^\n', 'p')).toThrow();
		expect(() => renderPlot('items:\n  - fn: x\n    color: "red;x"', 'p')).toThrow(/unknown color/);
		expect(() => renderPlot('items:\n  - text: $\\frac{1$\n    at: [0, 0]', 'p')).toThrow();
	});
});

describe('plot fences in markdown', () => {
	it('replaces the fence with the figure', async () => {
		const html = await renderMarkdown('```plot\nitems:\n  - fn: x^2\n```', resolve);
		expect(html).toContain('<figure class="plot">');
		expect(html).not.toContain('class="shiki');
	});
	it('renders an error block instead of failing the page', async () => {
		const html = await renderMarkdown('```plot\nitems:\n  - fn: nope(x)\n```', resolve);
		expect(html).toContain('class="plot-error"');
		expect(html).toContain('unknown function');
	});
	it('maps palette colours in KaTeX to theme variables', async () => {
		const html = await renderMarkdown('$\\textcolor{blue}{x} + \\textcolor{#123456}{y}$', resolve);
		expect(html).toContain('color:var(--palette-blue)');
		expect(html).toContain('color:#123456');
	});
});
