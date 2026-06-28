// app/vite-plugin-vault.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildManifest } from './vite-plugin-vault.js';

let vault: string, assetsOut: string;

beforeAll(async () => {
	const base = await mkdtemp(path.join(tmpdir(), 'vault-'));
	vault = path.join(base, 'it');
	assetsOut = path.join(base, 'out');
	await mkdir(path.join(vault, '01-fisica', 'attachments'), { recursive: true });
	await writeFile(
		path.join(vault, '01-fisica', 'index.md'),
		'---\ntitle: Fisica\ndescription: d\n---\noverview\n'
	);
	await writeFile(
		path.join(vault, '01-fisica', '01-intro.md'),
		'---\ntitle: Intro\ndescription: d\n---\nsee ![[img.png]]\n'
	);
	await writeFile(path.join(vault, '01-fisica', 'attachments', 'img.png'), 'PNGDATA');
});
afterAll(() => rm(path.dirname(vault), { recursive: true, force: true }));

describe('buildManifest', () => {
	it('parses frontmatter and copies assets with hashed names', async () => {
		const { files, assets } = await buildManifest(vault, assetsOut);
		const intro = files.find((f) => f.relPath === '01-fisica/01-intro.md');
		expect(intro?.frontmatter.title).toBe('Intro');
		expect(intro?.content.trim()).toBe('see ![[img.png]]');
		expect(assets['img.png']).toMatch(/^\/vault-assets\/img\.[0-9a-f]{8}\.png$/);
		const written = await readdir(assetsOut);
		expect(written.some((f) => /^img\.[0-9a-f]{8}\.png$/.test(f))).toBe(true);
	});

	it('returns empty manifest when vault dir does not exist', async () => {
		const result = await buildManifest('/nonexistent/path/that/does/not/exist', assetsOut);
		expect(result).toEqual({ files: [], assets: {} });
	});

	it('normalizes CRLF line endings in markdown content', async () => {
		const crlfVault = path.join(path.dirname(vault), 'crlf-vault');
		const crlfAssetsOut = path.join(path.dirname(vault), 'crlf-out');
		await mkdir(crlfVault, { recursive: true });
		await writeFile(
			path.join(crlfVault, 'crlf.md'),
			'---\r\ntitle: CRLF Test\r\n---\r\nline one\r\nline two\r\n'
		);
		try {
			const { files } = await buildManifest(crlfVault, crlfAssetsOut);
			const node = files.find((f) => f.relPath === 'crlf.md');
			expect(node).toBeDefined();
			expect(node!.content).not.toContain('\r');
		} finally {
			await rm(crlfVault, { recursive: true, force: true });
			await rm(crlfAssetsOut, { recursive: true, force: true }).catch(() => {});
		}
	});
});
