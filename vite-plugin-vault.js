// @ts-nocheck
// app/vite-plugin-vault.js
import { readdir, readFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter'; // CJS -> default import

/** Path to the excalidraw map produced by the prebuild step. */
const EXCALIDRAW_MAP_PATH = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'static/vault-assets/excalidraw-map.json'
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = path.resolve(__dirname, 'notes', 'it');
const VID = 'virtual:vault';
const RESOLVED = '\0' + VID;
const STATIC_ASSETS = path.resolve(__dirname, 'static/vault-assets');
const PUBLIC_BASE = '/vault-assets';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

export async function walkMd(dir, root = dir, out = []) {
	for (const e of await readdir(dir, { withFileTypes: true })) {
		if (e.name.startsWith('.')) continue;
		const abs = path.join(dir, e.name);
		if (e.isDirectory()) await walkMd(abs, root, out);
		else if (e.name.toLowerCase().endsWith('.md'))
			out.push({ absPath: abs, relPath: path.relative(root, abs).split(path.sep).join('/') });
	}
	return out;
}

async function walkAssets(dir, out = []) {
	for (const e of await readdir(dir, { withFileTypes: true })) {
		if (e.name.startsWith('.')) continue;
		const abs = path.join(dir, e.name);
		if (e.isDirectory()) await walkAssets(abs, out);
		else if (IMAGE_EXTS.has(path.extname(e.name).toLowerCase())) out.push(abs);
	}
	return out;
}

/**
 * Copy a single asset into destDir with an 8-char sha256 hash in the filename.
 * Returns the public URL path.
 */
export async function copyAsset(absSrc, destDir) {
	const buf = await readFile(absSrc);
	const hash = createHash('sha256').update(buf).digest('hex').slice(0, 8);
	const ext = path.extname(absSrc);
	const base = path.basename(absSrc, ext);
	const fileName = `${base}.${hash}${ext}`;
	await mkdir(destDir, { recursive: true });
	await copyFile(absSrc, path.join(destDir, fileName));
	return `${PUBLIC_BASE}/${fileName}`;
}

/**
 * Build the full vault manifest.
 * Returns { files: RawFile[], assets: Record<string, string> }.
 * Tolerates a missing vaultDir — returns empty manifest with a console.warn.
 */
export async function buildManifest(vaultDir, assetDestDir) {
	if (!existsSync(vaultDir)) {
		console.warn(`[vault] vault dir not found, returning empty manifest: ${vaultDir}`);
		return { files: [], assets: {} };
	}

	// Clean asset destination so deleted images don't linger — but PRESERVE the
	// excalidraw artifacts written by the prebuild (scripts/buildExcalidraw.mjs),
	// which populates this same dir (excalidraw/*.svg + excalidraw-map.json)
	// BEFORE vite build runs. A blanket rm here would wipe them before the map is
	// read below, so clean entry-by-entry and skip the excalidraw outputs.
	if (existsSync(assetDestDir)) {
		const PRESERVE = new Set(['excalidraw', 'excalidraw-map.json']);
		for (const entry of await readdir(assetDestDir)) {
			if (PRESERVE.has(entry)) continue;
			await rm(path.join(assetDestDir, entry), { recursive: true, force: true });
		}
	}

	// Walk markdown files.
	const mdEntries = await walkMd(vaultDir);
	const files = [];
	for (const { absPath, relPath } of mdEntries) {
		const raw = (await readFile(absPath, 'utf-8')).replace(/\r\n/g, '\n');
		const { data, content } = matter(raw);
		files.push({ relPath, frontmatter: data, content });
	}

	// Walk image/svg files and copy each with a hashed name.
	const assetPaths = await walkAssets(vaultDir);
	const assets = {};
	const assetSources = {}; // basename -> absSrc for collision reporting
	for (const absSrc of assetPaths) {
		const basename = path.basename(absSrc);
		if (assets[basename] !== undefined) {
			console.warn(
				`[vault] asset basename collision: "${basename}" — "${absSrc}" overwrites "${assetSources[basename]}". Rename one to avoid broken image links.`
			);
		}
		const publicUrl = await copyAsset(absSrc, assetDestDir);
		assets[basename] = publicUrl;
		assetSources[basename] = absSrc;
	}

	// Merge excalidraw map (produced by scripts/buildExcalidraw.mjs prebuild).
	// Key format: "<basename>.excalidraw" → { light: "/vault-assets/…", dark: "/vault-assets/…" }
	// We store these directly in assets so the embed handler can look them up.
	if (existsSync(EXCALIDRAW_MAP_PATH)) {
		try {
			const excalidrawMap = JSON.parse(await readFile(EXCALIDRAW_MAP_PATH, 'utf-8'));
			for (const [key, value] of Object.entries(excalidrawMap)) {
				// key is like "Drawing 2024-11-11 09.12.21.excalidraw"
				// Store as the bare key so resolve.asset(target) can look it up with the same key.
				assets[key] = value; // value = { light, dark }
			}
		} catch (err) {
			console.warn(`[vault] Could not read excalidraw map: ${err.message}`);
		}
	}

	return { files, assets };
}

export function vaultPlugin() {
	return {
		name: 'vault',
		enforce: 'pre',
		resolveId(id) {
			if (id === VID) return RESOLVED;
		},
		async load(id) {
			if (id !== RESOLVED) return;
			const { files, assets } = await buildManifest(VAULT_DIR, STATIC_ASSETS);
			return `export const files = ${JSON.stringify(files)};\nexport const assets = ${JSON.stringify(assets)};\nexport default files;`;
		},
		configureServer(server) {
			server.watcher.add(VAULT_DIR);
			const onChange = (f) => {
				const rel = path.relative(VAULT_DIR, path.resolve(f));
				if (rel.startsWith('..') || path.isAbsolute(rel)) return;
				const mod = server.moduleGraph.getModuleById(RESOLVED);
				if (mod) server.moduleGraph.invalidateModule(mod);
				server.ws.send({ type: 'full-reload' });
			};
			for (const ev of ['add', 'change', 'unlink']) server.watcher.on(ev, onChange);
		}
	};
}
