// expr.ts — a small, safe math expression compiler for ```plot fences.
// Plot specs come from note content, so instead of eval/new Function we parse a
// fixed grammar: numbers, the variable(s) in scope, + - * / ^, implicit
// multiplication (2x, 3(x+1), (x-1)(x+1)), calls to built-in or user-defined
// functions, and primes for numeric derivatives (f'(x), f''(x)).

export type Fn = (...args: number[]) => number;
export type Scope = {
	/** Numeric constants and variables, e.g. { x: 1, x0: 2 }. */
	vars: Record<string, number>;
	/** User-defined functions, e.g. f from `f(x) = x^2`. */
	fns: Record<string, Fn>;
};
type Node = (s: Scope) => number;

const BUILTINS: Record<string, Fn> = {
	sin: Math.sin,
	cos: Math.cos,
	tan: Math.tan,
	asin: Math.asin,
	acos: Math.acos,
	atan: Math.atan,
	arcsin: Math.asin,
	arccos: Math.acos,
	arctan: Math.atan,
	sinh: Math.sinh,
	cosh: Math.cosh,
	tanh: Math.tanh,
	exp: Math.exp,
	// Italian analysis courses write log for the natural logarithm.
	ln: Math.log,
	log: Math.log,
	log10: Math.log10,
	log2: Math.log2,
	sqrt: Math.sqrt,
	cbrt: Math.cbrt,
	abs: Math.abs,
	sign: Math.sign,
	floor: Math.floor,
	ceil: Math.ceil,
	round: Math.round,
	min: Math.min,
	max: Math.max,
	pow: Math.pow
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

/** Central-difference derivative; nesting it gives higher orders. */
function derivative(f: Fn): Fn {
	return (x) => {
		const h = 1e-4 * Math.max(1, Math.abs(x));
		return (f(x + h) - f(x - h)) / (2 * h);
	};
}

type Tok = { t: 'num' | 'id' | 'op'; v: string; pos: number };

function tokenize(src: string): Tok[] {
	const out: Tok[] = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (/\s/.test(c)) {
			i++;
		} else if (/[0-9.]/.test(c)) {
			const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i))!;
			if (!m) throw new Error(`bad number at "${src.slice(i)}"`);
			out.push({ t: 'num', v: m[0], pos: i });
			i += m[0].length;
		} else if (/[a-zA-Z_]/.test(c)) {
			const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i))!;
			out.push({ t: 'id', v: m[0], pos: i });
			i += m[0].length;
		} else if ("+-*/^(),'".includes(c)) {
			out.push({ t: 'op', v: c, pos: i });
			i++;
		} else {
			throw new Error(`unexpected "${c}" in "${src}"`);
		}
	}
	return out;
}

/**
 * Compile `src` into an evaluator. Identifiers are resolved at evaluation time,
 * so a function may refer to names defined later in the plot.
 */
export function compile(src: string): Node {
	const toks = tokenize(src);
	let p = 0;
	const peek = () => toks[p];
	const isOp = (v: string) => peek()?.t === 'op' && peek().v === v;
	const expect = (v: string) => {
		if (!isOp(v)) throw new Error(`expected "${v}" in "${src}"`);
		p++;
	};

	// expr := term (('+'|'-') term)*
	function expr(): Node {
		let left = term();
		while (isOp('+') || isOp('-')) {
			const op = toks[p++].v;
			const a = left,
				b = term();
			left = op === '+' ? (s) => a(s) + b(s) : (s) => a(s) - b(s);
		}
		return left;
	}

	// A token that can begin an implicitly multiplied factor: 2x, 2(x), (a)(b).
	const startsFactor = () => peek() && (peek().t !== 'op' || peek().v === '(');

	// term := unary (('*'|'/'|implicit) unary)*
	function term(): Node {
		let left = unary();
		for (;;) {
			if (isOp('*') || isOp('/')) {
				const op = toks[p++].v;
				const a = left,
					b = unary();
				left = op === '*' ? (s) => a(s) * b(s) : (s) => a(s) / b(s);
			} else if (startsFactor()) {
				const a = left,
					b = power();
				left = (s) => a(s) * b(s);
			} else return left;
		}
	}

	// unary := ('-'|'+') unary | power   — so -x^2 is -(x^2)
	function unary(): Node {
		if (isOp('-')) {
			p++;
			const a = unary();
			return (s) => -a(s);
		}
		if (isOp('+')) {
			p++;
			return unary();
		}
		return power();
	}

	// power := atom ('^' unary)?   — right-associative
	function power(): Node {
		const base = atom();
		if (isOp('^')) {
			p++;
			const e = unary();
			return (s) => Math.pow(base(s), e(s));
		}
		return base;
	}

	function atom(): Node {
		const tok = peek();
		if (!tok) throw new Error(`unexpected end of "${src}"`);
		if (tok.t === 'num') {
			p++;
			const n = Number(tok.v);
			return () => n;
		}
		if (isOp('(')) {
			p++;
			const e = expr();
			expect(')');
			return e;
		}
		if (tok.t === 'id') {
			p++;
			const name = tok.v;
			let primes = 0;
			while (isOp("'")) {
				p++;
				primes++;
			}
			// A call: name(args). Variables are never callable, so x(x-1) multiplies.
			if (isOp('(') && (primes > 0 || !(name in CONSTANTS) || name in BUILTINS)) {
				const isFn = (s: Scope) => name in s.fns || name in BUILTINS;
				p++;
				const args: Node[] = [expr()];
				while (isOp(',')) {
					p++;
					args.push(expr());
				}
				expect(')');
				return (s) => {
					if (!isFn(s)) {
						if (primes === 0 && name in s.vars && args.length === 1)
							return s.vars[name] * args[0](s);
						throw new Error(`unknown function "${name}"`);
					}
					let f: Fn = s.fns[name] ?? BUILTINS[name];
					for (let i = 0; i < primes; i++) f = derivative(f);
					return f(...args.map((a) => a(s)));
				};
			}
			if (primes > 0) throw new Error(`"${name}'" must be called, e.g. ${name}'(x)`);
			return (s) => {
				if (name in s.vars) return s.vars[name];
				if (name in CONSTANTS) return CONSTANTS[name];
				throw new Error(`unknown name "${name}"`);
			};
		}
		throw new Error(`unexpected "${tok.v}" in "${src}"`);
	}

	const root = expr();
	if (p < toks.length) throw new Error(`unexpected "${toks[p].v}" in "${src}"`);
	return root;
}

/** Parse `f(x) = body` into its parts; returns null for a bare expression. */
export function parseDefinition(
	src: string
): { name: string; params: string[]; body: string } | null {
	const m = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=(.*)$/.exec(src);
	if (!m) return null;
	const params = m[2].split(',').map((s) => s.trim());
	if (params.some((s) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)))
		throw new Error(`bad parameters in "${src}"`);
	return { name: m[1], params, body: m[3] };
}

/** Turn a compiled body into a callable bound to `scope` (so it sees later definitions). */
export function bind(body: Node, params: string[], scope: Scope): Fn {
	return (...args) => {
		const vars = { ...scope.vars };
		params.forEach((name, i) => (vars[name] = args[i]));
		return body({ vars, fns: scope.fns });
	};
}
