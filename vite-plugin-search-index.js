// vite-plugin-search-index.js
// @ts-nocheck
//
// Emits the client search index as a single cacheable binary resource at
// `/search-index.bin`: gzip-compressed JSON of the whole entry array (one blob,
// so repeated terms across notes compress well). The runtime inflates it with
// the native DecompressionStream('gzip').
//
// Dev: served on demand by a middleware (rebuilt when vault files change).
// Build: emitted as a static asset via Rollup's emitFile.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { walkMd } from './vite-plugin-vault.js';
import { buildSearchIndex } from './scripts/searchIndex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = path.resolve(__dirname, 'notes', 'it');
const FILE_NAME = 'search-index.bin';

async function readFiles(vaultDir) {
	if (!existsSync(vaultDir)) {
		console.warn(`[search-index] vault dir not found, emitting empty index: ${vaultDir}`);
		return [];
	}
	const entries = await walkMd(vaultDir);
	const files = [];
	for (const { absPath, relPath } of entries) {
		const raw = (await readFile(absPath, 'utf-8')).replace(/\r\n/g, '\n');
		const { data, content } = matter(raw);
		files.push({ relPath, frontmatter: data, content });
	}
	return files;
}

/** Returns a gzip Buffer of the JSON entry array. */
async function buildPayload() {
	const files = await readFiles(VAULT_DIR);
	const entries = buildSearchIndex(files);
	return gzipSync(Buffer.from(JSON.stringify(entries), 'utf-8'));
}

export function searchIndexPlugin() {
	return {
		name: 'search-index',
		// Build only — Rollup emits the asset into the output dir.
		async generateBundle() {
			const source = await buildPayload();
			this.emitFile({ type: 'asset', fileName: FILE_NAME, source });
		},
		// Dev only — serve the index, rebuilding when the vault changes.
		configureServer(server) {
			let devCache = null;
			const invalidate = (f) => {
				const rel = path.relative(VAULT_DIR, path.resolve(f));
				if (rel.startsWith('..') || path.isAbsolute(rel)) return;
				devCache = null;
			};
			server.watcher.add(VAULT_DIR);
			for (const ev of ['add', 'change', 'unlink']) server.watcher.on(ev, invalidate);

			server.middlewares.use(async (req, res, next) => {
				const url = (req.url || '').split('?')[0];
				if (url !== '/' + FILE_NAME) return next();
				try {
					if (!devCache) devCache = await buildPayload();
					res.setHeader('Content-Type', 'application/octet-stream');
					res.setHeader('Cache-Control', 'no-cache');
					res.end(devCache);
				} catch (e) {
					res.statusCode = 500;
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify({ error: String((e && e.message) || e) }));
				}
			});
		}
	};
}
