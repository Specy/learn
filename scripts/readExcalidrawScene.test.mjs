import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { readExcalidrawScene } from './readExcalidrawScene.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('readExcalidrawScene', () => {
  it('decompresses the compressed-json fence to a scene with elements', () => {
    const scene = readExcalidrawScene(path.join(here, '__fixtures__/sample.excalidraw.md'));
    expect(Array.isArray(scene.elements)).toBe(true);
    expect(scene.elements.length).toBeGreaterThan(0);
  });

  it('returns a scene object with expected structure', () => {
    const scene = readExcalidrawScene(path.join(here, '__fixtures__/sample.excalidraw.md'));
    expect(scene).toBeTypeOf('object');
    expect(scene).not.toBeNull();
    // elements should be real Excalidraw elements
    const el = scene.elements[0];
    expect(el).toHaveProperty('id');
    expect(el).toHaveProperty('type');
  });

  it('reads a plain json fence and returns a scene with elements', () => {
    const tmpFile = path.join(here, '__fixtures__/tmp-json-fence.excalidraw.md');
    const minimalScene = JSON.stringify({ elements: [{ id: 'x', type: 'rectangle' }] });
    fs.writeFileSync(tmpFile, `\`\`\`json\n${minimalScene}\n\`\`\`\n`, 'utf8');
    try {
      const scene = readExcalidrawScene(tmpFile);
      expect(Array.isArray(scene.elements)).toBe(true);
      expect(scene.elements.length).toBeGreaterThan(0);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
