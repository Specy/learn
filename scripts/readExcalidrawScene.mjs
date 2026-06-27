// app/scripts/readExcalidrawScene.mjs
import fs from 'node:fs';
import LZString from 'lz-string'; // CJS default import

/**
 * Read an Excalidraw markdown file (.excalidraw.md) and return the parsed scene
 * object. Handles both `compressed-json` (LZ-string base64) and plain `json`
 * fenced blocks. Normalises CRLF before parsing.
 *
 * @param {string} filePath  Absolute path to the .excalidraw.md file
 * @returns {{ elements: any[], appState?: any, files?: any }}
 */
export function readExcalidrawScene(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

  // Try compressed-json first (Obsidian Excalidraw plugin default on Windows)
  const compressedMatch = raw.match(/```compressed-json\n([\s\S]*?)\n```/);
  if (compressedMatch) {
    const compressed = compressedMatch[1].replace(/\s/g, '');
    const json = LZString.decompressFromBase64(compressed);
    if (!json) throw new Error(`lz-string decompress failed for ${filePath}`);
    return JSON.parse(json);
  }

  // Fallback: plain json fence
  const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }

  throw new Error(`No Drawing fence (compressed-json or json) found in ${filePath}`);
}
