// renderPlot.ts — turns a ```plot fence (YAML) into static, theme-aware SVG.
// Rendered at build time like KaTeX, so plots ship no client JS. Labels are
// HTML overlays positioned in % of the plot box, which lets them use KaTeX and
// keeps them readable when the SVG scales down on narrow screens.
import katex from 'katex';
import matter from 'gray-matter';
import { bind, compile, parseDefinition, type Fn, type Scope } from './expr';

type Num = number | string;
type Pt = [Num, Num];
type Item = Record<string, unknown>;

/** Named colours resolve to theme-aware CSS variables (see app.css). */
export const PALETTE = ['fg', 'muted', 'blue', 'red', 'green', 'orange', 'purple', 'teal'] as const;
const ANCHORS = new Set(['c', 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
const KINDS = [
	'fn',
	'area',
	'riemann',
	'line',
	'vline',
	'hline',
	'point',
	'guide',
	'text',
	'brace'
];

const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

function color(name: unknown, fallback = 'fg'): string {
	const c = name === undefined ? fallback : String(name);
	if ((PALETTE as readonly string[]).includes(c)) return `var(--palette-${c})`;
	if (/^#[0-9a-f]{3,8}$/i.test(c)) return c;
	throw new Error(`unknown color "${c}" (use ${PALETTE.join(', ')} or #hex)`);
}

function dash(d: unknown): string {
	if (d === undefined || d === false) return '';
	if (d === true || d === 'dashed') return ';stroke-dasharray:6 4';
	if (d === 'dotted') return ';stroke-dasharray:1.5 3.5;stroke-linecap:round';
	throw new Error(`dash must be true, "dashed" or "dotted", got "${d}"`);
}

/** Text with `$…$` segments rendered by KaTeX, the rest escaped. */
export function renderLabel(label: string): string {
	return String(label)
		.split(/(\$[^$]+\$)/)
		.map((part) =>
			/^\$[^$]+\$$/.test(part)
				? katex.renderToString(part.slice(1, -1), { throwOnError: true })
				: esc(part)
		)
		.join('');
}

/** Roughly 6 "nice" (1/2/5 × 10^k) steps across the range. */
function niceStep(span: number): number {
	const raw = span / 6;
	const mag = Math.pow(10, Math.floor(Math.log10(raw)));
	const n = raw / mag;
	return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

function range(a: number, b: number, step: number): number[] {
	const out: number[] = [];
	for (let v = Math.ceil(a / step) * step; v <= b + step * 1e-9; v += step)
		out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
	return out;
}

export function renderPlot(source: string, id: string): string {
	const spec = matter(`---\n${source}\n---\n`).data as Record<string, unknown>;
	const items = (spec.items ?? []) as Item[];
	if (!Array.isArray(items)) throw new Error('"items" must be a list');

	// ── scope: user functions first (so order never matters), then `let` ──
	const scope: Scope = { vars: {}, fns: {} };
	const curves = new Map<Item, Fn>();
	for (const item of items) {
		const kind = KINDS.find((k) => k in item);
		if (!kind) throw new Error(`item needs one of: ${KINDS.join(', ')}`);
		if (kind !== 'fn') continue;
		const src = String(item.fn);
		const def = parseDefinition(src);
		if (def) {
			scope.fns[def.name] = bind(compile(def.body), def.params, scope);
			curves.set(item, scope.fns[def.name]);
		} else curves.set(item, inX(src));
	}
	for (const [name, value] of Object.entries((spec.let ?? {}) as Record<string, Num>))
		scope.vars[name] = num(value);

	function num(v: unknown): number {
		if (typeof v === 'number') return v;
		const n = compile(String(v))(scope);
		if (!Number.isFinite(n)) throw new Error(`"${v}" is not a finite number`);
		return n;
	}
	function pt(p: unknown): [number, number] {
		if (!Array.isArray(p) || p.length !== 2)
			throw new Error(`expected a point [x, y], got ${JSON.stringify(p)}`);
		return [num((p as Pt)[0]), num((p as Pt)[1])];
	}
	function inX(src: string): Fn {
		const node = compile(src);
		return (x) => node({ vars: { ...scope.vars, x }, fns: scope.fns });
	}

	// ── geometry ──
	const [x0, x1] = (spec.x as Num[] | undefined)?.map(num) ?? [-5, 5];
	const [y0, y1] = (spec.y as Num[] | undefined)?.map(num) ?? [-5, 5];
	if (!(x1 > x0) || !(y1 > y0)) throw new Error('x and y must be [min, max] with min < max');
	const W = Number(spec.width ?? 480);
	const H = Number(spec.height ?? 300);
	const X = (x: number) => ((x - x0) / (x1 - x0)) * W;
	const Y = (y: number) => H - ((y - y0) / (y1 - y0)) * H;
	const clampY = (py: number) => Math.max(-H * 4, Math.min(H * 5, py));
	const axisX = Math.min(Math.max(0, x0), x1); // where the y-axis sits
	const axisY = Math.min(Math.max(0, y0), y1); // where the x-axis sits

	const back: string[] = []; // fills, grid — drawn under everything
	const fore: string[] = []; // strokes and points
	const labels: string[] = [];

	function label(text: unknown, x: number, y: number, anchor = 'c', col?: unknown) {
		if (text === undefined || text === null || text === '') return;
		if (!ANCHORS.has(anchor)) throw new Error(`anchor must be one of ${[...ANCHORS].join(', ')}`);
		const style =
			`left:${f2((x / W) * 100)}%;top:${f2((y / H) * 100)}%` + (col ? `;color:${color(col)}` : '');
		labels.push(
			`<span class="plot-label plot-a-${anchor}" style="${style}">${renderLabel(String(text))}</span>`
		);
	}
	const stroke = (it: Item, fallback = 'fg', width = 1.6) =>
		`style="stroke:${color(it.color, fallback)};stroke-width:${Number(it.width ?? width)}${dash(it.dash)}"`;
	const fill = (col: string, it: Item, opacity = 0.3) =>
		`style="fill:${col};fill-opacity:${Number(it.opacity ?? opacity)};stroke:none"`;
	const poly = (pts: [number, number][]) =>
		pts.map(([x, y]) => `${f2(X(x))},${f2(clampY(Y(y)))}`).join(' ');
	const arrowHead = (tx: number, ty: number, fx: number, fy: number, col: string) => {
		const a = Math.atan2(ty - fy, tx - fx);
		const p = (r: number, da: number) =>
			`${f2(tx - r * Math.cos(a + da))},${f2(ty - r * Math.sin(a + da))}`;
		return `<polygon points="${f2(tx)},${f2(ty)} ${p(9, 0.38)} ${p(9, -0.38)}" style="fill:${col}"/>`;
	};
	/** Sample f across [a, b] (clipped to the view), breaking at gaps and asymptotes. */
	function sample(f: Fn, a: number, b: number, n = 400): [number, number][][] {
		const runs: [number, number][][] = [];
		let run: [number, number][] = [];
		let prev: number | null = null;
		for (let i = 0; i <= n; i++) {
			const x = a + ((b - a) * i) / n;
			const y = f(x);
			const jump = prev !== null && ((prev > y1 && y < y0) || (prev < y0 && y > y1));
			if (!Number.isFinite(y) || jump) {
				if (run.length > 1) runs.push(run);
				run = [];
				prev = Number.isFinite(y) ? y : null;
				if (!Number.isFinite(y)) continue;
			}
			run.push([x, y]);
			prev = y;
		}
		if (run.length > 1) runs.push(run);
		return runs;
	}
	const span = (it: Item): [number, number] => [
		it.from === undefined ? x0 : num(it.from),
		it.to === undefined ? x1 : num(it.to)
	];

	// ── grid & axes ──
	const tickStep = (v: unknown, s: number) =>
		v === true ? niceStep(s) : typeof v === 'number' ? v : 0;
	const gridStep = tickStep(spec.grid, Math.max(x1 - x0, y1 - y0));
	if (gridStep) {
		const g = [
			...range(x0, x1, gridStep).map((x) => `M${f2(X(x))} 0V${H}`),
			...range(y0, y1, gridStep).map((y) => `M0 ${f2(Y(y))}H${W}`)
		].join('');
		back.push(`<path class="plot-grid" d="${g}"/>`);
	}
	if (spec.axes !== false) {
		const ax = X(axisX),
			ay = Y(axisY);
		fore.push(`<path class="plot-axis" d="M0 ${f2(ay)}H${W - 1}M${f2(ax)} ${H}V1"/>`);
		fore.push(
			arrowHead(W, ay, 0, ay, 'var(--palette-fg)'),
			arrowHead(ax, 0, ax, H, 'var(--palette-fg)')
		);
		label(spec.xlabel, W, ay, 'se');
		label(spec.ylabel, ax, 0, 'ne');

		const ticks = (v: unknown, lo: number, hi: number): [number, string][] => {
			if (v && typeof v === 'object' && !Array.isArray(v))
				return Object.entries(v as Record<string, string>).map(([k, l]) => [num(k), String(l)]);
			const list = Array.isArray(v)
				? v.map(num)
				: range(lo, hi, tickStep(v ?? spec.ticks, hi - lo));
			return list.map((t) => [t, `$${+t.toPrecision(6)}$`]);
		};
		for (const [t, l] of ticks(spec.xticks, x0, x1)) {
			if (t === axisX && !spec.xticks) continue; // the origin is labelled by neither axis
			fore.push(`<path class="plot-axis" d="M${f2(X(t))} ${f2(ay - 3)}v6"/>`);
			label(l, X(t), ay + 2, 's');
		}
		for (const [t, l] of ticks(spec.yticks, y0, y1)) {
			if (t === axisY && !spec.yticks) continue;
			fore.push(`<path class="plot-axis" d="M${f2(ax - 3)} ${f2(Y(t))}h6"/>`);
			label(l, ax - 3, Y(t), 'w');
		}
	}

	// ── items, in order (later items draw on top) ──
	for (const it of items) {
		if ('fn' in it) {
			if (it.hidden) continue;
			const f = curves.get(it)!;
			const [a, b] = it.domain ? (it.domain as Num[]).map(num) : [x0, x1];
			const [lo, hi] = [Math.max(a, x0), Math.min(b, x1)];
			const runs = sample(f, lo, hi, Number(it.samples ?? 400));
			const d = runs.map((r) => 'M' + poly(r).replace(/ /g, 'L')).join('');
			fore.push(`<path d="${d}" fill="none" ${stroke(it)} clip-path="url(#${id})"/>`);
			if (it.label) {
				const lx = it.labelAt !== undefined ? num(it.labelAt) : lo + (hi - lo) * 0.9;
				label(it.label, X(lx), clampY(Y(f(lx))), String(it.anchor ?? 'n'), it.color);
			}
		} else if ('area' in it) {
			const f = inX(String(it.area));
			const g = it.base === undefined ? () => 0 : inX(String(it.base));
			const [a, b] = span(it);
			const [pos, neg] = it.signed
				? [color(it.positive, 'green'), color(it.negative, 'red')]
				: [color(it.color, 'blue'), color(it.color, 'blue')];
			// Split at sign changes of f - g so a signed area colours each lobe.
			const n = 400;
			let piece: { top: [number, number][]; bot: [number, number][] } = { top: [], bot: [] };
			let sign = 0;
			const flush = () => {
				if (piece.top.length > 1)
					back.push(
						`<polygon points="${poly([...piece.top, ...piece.bot.reverse()])}" ${fill(sign >= 0 ? pos : neg, it)} clip-path="url(#${id})"/>`
					);
			};
			let px = a,
				pd = f(a) - g(a);
			for (let i = 0; i <= n; i++) {
				const x = a + ((b - a) * i) / n;
				const fx = f(x),
					gx = g(x),
					d = fx - gx;
				const s = Math.sign(d);
				if (i > 0 && s !== 0 && sign !== 0 && s !== sign) {
					const cx = px + ((x - px) * pd) / (pd - d); // linear crossing estimate
					const cy = g(cx);
					piece.top.push([cx, cy]);
					piece.bot.push([cx, cy]);
					flush();
					piece = { top: [[cx, cy]], bot: [[cx, cy]] };
				}
				if (s !== 0) sign = s;
				piece.top.push([x, fx]);
				piece.bot.push([x, gx]);
				px = x;
				pd = d;
			}
			flush();
		} else if ('riemann' in it) {
			const f = inX(String(it.riemann));
			const [a, b] = span(it);
			const n = Number(it.n ?? 6);
			const mode = String(it.mode ?? 'left');
			const col = color(it.color, 'blue');
			for (let i = 0; i < n; i++) {
				const l = a + ((b - a) * i) / n,
					r = a + ((b - a) * (i + 1)) / n;
				let h: number;
				if (mode === 'left') h = f(l);
				else if (mode === 'right') h = f(r);
				else if (mode === 'mid') h = f((l + r) / 2);
				else if (mode === 'lower' || mode === 'upper') {
					const ys = Array.from({ length: 33 }, (_, k) => f(l + ((r - l) * k) / 32));
					h = mode === 'lower' ? Math.min(...ys) : Math.max(...ys);
				} else throw new Error('riemann mode must be left, right, mid, lower or upper');
				const top = Math.min(Y(h), Y(0)),
					ht = Math.abs(Y(h) - Y(0));
				back.push(
					`<rect x="${f2(X(l))}" y="${f2(top)}" width="${f2(X(r) - X(l))}" height="${f2(ht)}" style="fill:${col};fill-opacity:${Number(it.opacity ?? 0.3)};stroke:${col};stroke-width:1"/>`
				);
			}
		} else if ('line' in it) {
			const pts = (it.line as unknown[]).map(pt);
			if (pts.length < 2) throw new Error('line needs at least two points');
			const col = color(it.color);
			fore.push(
				`<polyline points="${poly(pts)}" fill="none" ${stroke(it)} clip-path="url(#${id})"/>`
			);
			if (it.arrow) {
				const [[fx, fy], [tx, ty]] = pts.slice(-2);
				fore.push(arrowHead(X(tx), Y(ty), X(fx), Y(fy), col));
			}
			if (it.label) {
				const [lx, ly] = pts[it.arrow ? 0 : pts.length - 1];
				label(it.label, X(lx), Y(ly), String(it.anchor ?? 'ne'), it.color);
			}
		} else if ('vline' in it || 'hline' in it) {
			const v = num(it.vline ?? it.hline);
			const d = 'vline' in it ? `M${f2(X(v))} 0V${H}` : `M0 ${f2(Y(v))}H${W}`;
			fore.push(`<path d="${d}" ${stroke({ dash: true, ...it }, 'muted', 1.2)}/>`);
			if ('vline' in it) label(it.label, X(v), 0, String(it.anchor ?? 'ne'), it.color);
			else label(it.label, W, Y(v), String(it.anchor ?? 'nw'), it.color);
		} else if ('point' in it) {
			const [x, y] = pt(it.point);
			const col = color(it.color);
			const inner = it.open ? 'var(--background)' : col;
			fore.push(
				`<circle cx="${f2(X(x))}" cy="${f2(Y(y))}" r="3.2" style="fill:${inner};stroke:${col};stroke-width:1.4" clip-path="url(#${id})"/>`
			);
			if (x >= x0 && x <= x1 && y >= y0 && y <= y1)
				label(it.label, X(x), Y(y), String(it.anchor ?? 'ne'), it.color);
		} else if ('guide' in it) {
			const [x, y] = pt(it.guide);
			const d = `M${f2(X(x))} ${f2(Y(axisY))}V${f2(Y(y))}H${f2(X(axisX))}`;
			back.push(`<path d="${d}" fill="none" ${stroke({ dash: 'dotted', ...it }, 'muted', 1.2)}/>`);
		} else if ('text' in it) {
			const [x, y] = pt(it.at);
			label(it.text, X(x), Y(y), String(it.anchor ?? 'c'), it.color);
		} else if ('brace' in it) {
			const [[ax, ay], [bx, by]] = (it.brace as unknown[]).map(pt).map(([x, y]) => [X(x), Y(y)]);
			const len = Math.hypot(bx - ax, by - ay);
			const [ux, uy] = [(bx - ax) / len, (by - ay) / len];
			const [nx, ny] = [-uy, ux]; // points right of the direction a → b
			const h = 5,
				r = Math.min(8, len / 4);
			const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
			const P = (x: number, y: number, along: number, out: number) =>
				`${f2(x + ux * along + nx * out)} ${f2(y + uy * along + ny * out)}`;
			const d =
				`M${P(ax, ay, 0, 0)}Q${P(ax, ay, 0, h)} ${P(ax, ay, r, h)}L${P(mx, my, -r, h)}` +
				`Q${P(mx, my, 0, h)} ${P(mx, my, 0, 2 * h)}Q${P(mx, my, 0, h)} ${P(mx, my, r, h)}` +
				`L${P(bx, by, -r, h)}Q${P(bx, by, 0, h)} ${P(bx, by, 0, 0)}`;
			fore.push(`<path d="${d}" fill="none" ${stroke(it, 'fg', 1.4)}/>`);
			const anchor = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'e' : 'w') : ny > 0 ? 's' : 'n';
			label(it.label, mx + nx * 2 * h, my + ny * 2 * h, anchor, it.color);
		}
	}

	const alt = esc(String(spec.alt ?? spec.caption ?? 'Grafico'));
	const svg =
		`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt}">` +
		`<defs><clipPath id="${id}"><rect width="${W}" height="${H}"/></clipPath></defs>` +
		back.join('') +
		fore.join('') +
		`</svg>`;
	const caption = spec.caption
		? `<figcaption>${renderLabel(String(spec.caption))}</figcaption>`
		: '';
	return `<figure class="plot"><div class="plot-box" style="max-width:${W}px">${svg}${labels.join('')}</div>${caption}</figure>`;
}
