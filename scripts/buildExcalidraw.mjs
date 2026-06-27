// app/scripts/buildExcalidraw.mjs
// Prebuild runner: walks ../it for *.excalidraw.md, exports light+dark SVGs
// into static/vault-assets/excalidraw/, writes excalidraw-map.json.
//
// Graceful fallback: any per-file error is logged and skipped.
// If Chromium/network is unavailable the whole run exits 0 with an (empty) map.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readExcalidrawScene } from './readExcalidrawScene.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = path.resolve(__dirname, '..', 'notes', 'it');
const OUT_DIR = path.resolve(__dirname, '..', 'static', 'vault-assets', 'excalidraw');
const MAP_PATH = path.resolve(__dirname, '..', 'static', 'vault-assets', 'excalidraw-map.json');

/** Recursively collect all *.excalidraw.md files under a directory. */
function walkExcalidraw(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walkExcalidraw(abs, out);
    else if (e.name.toLowerCase().endsWith('.excalidraw.md')) out.push(abs);
  }
  return out;
}

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const excalidrawFiles = walkExcalidraw(VAULT_DIR);
  console.log(`[buildExcalidraw] Found ${excalidrawFiles.length} excalidraw file(s) in ${VAULT_DIR}`);

  const map = {};

  if (excalidrawFiles.length === 0) {
    // Nothing to do; write empty map and exit cleanly
    fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
    console.log(`[buildExcalidraw] No files to export; wrote empty map to ${MAP_PATH}`);
    return;
  }

  // Lazy-import the exporter so that if Playwright/Chromium is unavailable,
  // we catch the error here and still exit 0.
  let exporter = null;
  try {
    const { makeExporter } = await import('./excalidrawExporter.mjs');
    exporter = await makeExporter();
    console.log('[buildExcalidraw] Chromium exporter ready');
  } catch (err) {
    console.error('[buildExcalidraw] Could not start Chromium exporter (skipping all exports):', err.message);
    fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
    console.log(`[buildExcalidraw] Wrote empty map to ${MAP_PATH}`);
    return;
  }

  try {
    for (const absPath of excalidrawFiles) {
      // Derive output key: "<basename>.excalidraw" (strip trailing .md)
      const baseName = path.basename(absPath, '.md'); // e.g. "Drawing 2024-11-11 09.12.21.excalidraw"
      const safeName = baseName.replace(/\s+/g, '_'); // filesystem-safe

      let scene;
      try {
        scene = readExcalidrawScene(absPath);
      } catch (err) {
        console.error(`[buildExcalidraw] Failed to read scene ${absPath}: ${err.message}`);
        continue;
      }

      let lightSvg = null;
      let darkSvg = null;

      try {
        lightSvg = await exporter.exportScene(scene, { dark: false });
      } catch (err) {
        console.error(`[buildExcalidraw] Light export failed for ${baseName}: ${err.message}`);
      }

      try {
        darkSvg = await exporter.exportScene(scene, { dark: true });
      } catch (err) {
        console.error(`[buildExcalidraw] Dark export failed for ${baseName}: ${err.message}`);
      }

      if (!lightSvg && !darkSvg) {
        console.error(`[buildExcalidraw] Both exports failed for ${baseName} (no live elements or error); skipping`);
        continue;
      }

      const lightFile = `${safeName}.light.svg`;
      const darkFile = `${safeName}.dark.svg`;

      if (lightSvg) {
        fs.writeFileSync(path.join(OUT_DIR, lightFile), lightSvg, 'utf8');
        console.log(`[buildExcalidraw]   ✓ ${lightFile}`);
      }
      if (darkSvg) {
        fs.writeFileSync(path.join(OUT_DIR, darkFile), darkSvg, 'utf8');
        console.log(`[buildExcalidraw]   ✓ ${darkFile}`);
      }

      // Map key = original baseName (before safe-name conversion) for lookup by asset name
      map[baseName] = {
        light: lightSvg ? `/vault-assets/excalidraw/${lightFile}` : null,
        dark: darkSvg ? `/vault-assets/excalidraw/${darkFile}` : null
      };
    }
  } finally {
    await exporter.close();
  }

  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
  console.log(`[buildExcalidraw] Wrote map (${Object.keys(map).length} entries) to ${MAP_PATH}`);
}

main().catch((err) => {
  // Top-level catch: log but exit 0 so the build is never broken
  console.error('[buildExcalidraw] Unexpected fatal error (build continues):', err);
  process.exit(0);
});
