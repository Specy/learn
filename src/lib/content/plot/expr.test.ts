import { describe, it, expect } from 'vitest';
import { bind, compile, parseDefinition, type Scope } from './expr';

const run = (src: string, vars: Record<string, number> = {}, fns: Scope['fns'] = {}) =>
	compile(src)({ vars, fns });

describe('compile', () => {
	it('follows operator precedence and right-associative powers', () => {
		expect(run('1 + 2 * 3')).toBe(7);
		expect(run('2^3^2')).toBe(512);
		expect(run('-x^2', { x: 3 })).toBe(-9);
	});
	it('supports implicit multiplication', () => {
		expect(run('2x', { x: 4 })).toBe(8);
		expect(run('2(x+1)', { x: 1 })).toBe(4);
		expect(run('(x-1)(x+1)', { x: 3 })).toBe(8);
		expect(run('x(x-1)', { x: 3 })).toBe(6);
		expect(run('2 sin(x)', { x: Math.PI / 2 })).toBeCloseTo(2);
	});
	it('knows built-ins and constants', () => {
		expect(run('ln(e)')).toBeCloseTo(1);
		expect(run('cos(pi)')).toBeCloseTo(-1);
		expect(run('max(1, 5, 3)')).toBe(5);
	});
	it('differentiates user functions with primes', () => {
		const f = (x: number) => x ** 3;
		expect(run("f'(2)", {}, { f })).toBeCloseTo(12, 4);
		expect(run("f''(2)", {}, { f })).toBeCloseTo(12, 2);
	});
	it('rejects unknown names and stray tokens', () => {
		expect(() => run('y + 1')).toThrow(/unknown name "y"/);
		expect(() => run('g(1)')).toThrow(/unknown function "g"/);
		expect(() => compile('1 +')).toThrow();
		expect(() => compile('1 ; 2')).toThrow();
	});
});

describe('definitions', () => {
	it('parses f(x) = body and binds it to the scope', () => {
		const def = parseDefinition('f(x) = 2x + a')!;
		expect(def.name).toBe('f');
		const scope: Scope = { vars: { a: 1 }, fns: {} };
		scope.fns.f = bind(compile(def.body), def.params, scope);
		expect(run('f(3)', scope.vars, scope.fns)).toBe(7);
	});
	it('returns null for a bare expression', () => {
		expect(parseDefinition('x^2 + 1')).toBeNull();
	});
});
