import { describe, it, expect } from 'vitest';
import { renderPlot, smooth } from './renderPlot';
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

describe('plot options', () => {
	it('smooth() passes through its points with flat tangents at extrema', () => {
		const f = smooth([
			[0, 1],
			[1, 2],
			[2, 0.5],
			[3, 2.5]
		]);
		expect(f(1)).toBeCloseTo(2);
		expect(f(2)).toBeCloseTo(0.5);
		expect((f(1 + 1e-4) - f(1 - 1e-4)) / 2e-4).toBeCloseTo(0, 3);
		expect(f(1.5)).toBeLessThan(2); // no overshoot past the max
		expect(f(4)).toBeNaN();
	});
	it('fn + through defines a named curve other items can use', () => {
		const html = renderPlot(
			'x: [0, 3]\ny: [0, 3]\nitems:\n  - fn: f\n    through: [[0, 1], [1.5, 2], [3, 1]]\n  - point: [1.5, f(1.5)]',
			'p'
		);
		expect(html).toContain('cy="100"'); // y = 2 → 300 - 2/3*300
	});
	it('axes: x draws only the x-axis, guide to: x only the drop line', () => {
		const html = renderPlot(
			'x: [0, 2]\ny: [0, 2]\naxes: x\nitems:\n  - guide: [1, 1]\n    to: x',
			'p'
		);
		expect(html.match(/class="plot-axis" d="M0 /g)).toHaveLength(1);
		expect(html).not.toContain('V1"');
		expect(html).toMatch(/d="M240 300V150"/);
	});
});

describe('points', () => {
	it('draws one marker per point in the chosen shape', () => {
		const html = renderPlot(
			'x: [0, 4]\ny: [0, 4]\nitems:\n  - points: [[1, 1], [2, 3], [3, 2]]\n    shape: x\n    color: red',
			'p'
		);
		expect(html.match(/stroke:var\(--palette-red\);stroke-width:1.6/g)).toHaveLength(3);
	});
	it('rejects unknown shapes', () => {
		expect(() => renderPlot('items:\n  - points: [[0, 0]]\n    shape: star', 'p')).toThrow(/shape/);
	});
});

describe('circle and axis labels', () => {
	it('draws a circle in data units, an ellipse with rx/ry', () => {
		const html = renderPlot(
			'x: [0, 4]\ny: [0, 2]\nwidth: 400\nheight: 200\nitems:\n  - circle: [2, 1]\n    r: 1\n  - circle: [1, 1]\n    rx: 0.5\n    ry: 0.25\n    fill: true',
			'p'
		);
		expect(html).toContain('rx="100" ry="100"');
		expect(html).toContain('rx="50" ry="25"');
		expect(html).toContain('fill-opacity:0.15');
	});
	it('puts a long x label under the axis, a short one by the arrow', () => {
		expect(renderPlot('xlabel: $x$\nitems: []', 'p')).toContain('plot-a-se');
		expect(renderPlot('xlabel: "attribute 1 (X): weight index"\nitems: []', 'p')).toContain(
			'plot-a-xl'
		);
	});
});

describe('aspect', () => {
	it('aspect: equal sizes the height so circles are round', () => {
		const html = renderPlot(
			'x: [0, 4]\ny: [0, 2]\naspect: equal\nitems:\n  - circle: [2, 1]\n    r: 1',
			'p'
		);
		expect(html).toContain('viewBox="0 0 480 240"');
		expect(html).toContain('rx="120" ry="120"');
	});
});
