// app/scripts/excalidrawExporter.mjs
// Headless Chromium exporter for Excalidraw scenes via Playwright + esm.sh.
// Reuses a single browser/page instance across multiple exports.
import { chromium } from 'playwright';

const EXCALIDRAW_VERSION = '0.18.1';
const REACT_VERSION = '19.0.0';

// Bootstrap HTML that imports @excalidraw/excalidraw via esm.sh with an import map
// so React peer deps are resolved consistently.
const BOOT_HTML = `<!DOCTYPE html><html><head>
<script type="importmap">{"imports":{
  "react":"https://esm.sh/react@${REACT_VERSION}",
  "react/jsx-runtime":"https://esm.sh/react@${REACT_VERSION}/jsx-runtime",
  "react-dom":"https://esm.sh/react-dom@${REACT_VERSION}",
  "react-dom/client":"https://esm.sh/react-dom@${REACT_VERSION}/client"
}}</script>
<script>window.EXCALIDRAW_ASSET_PATH="https://esm.sh/@excalidraw/excalidraw@${EXCALIDRAW_VERSION}/dist/prod/";</script>
</head><body><script type="module">
  import * as L from 'https://esm.sh/@excalidraw/excalidraw@${EXCALIDRAW_VERSION}/dist/prod/index.js?external=react,react-dom';
  window.ExcalidrawLib = L;
</script></body></html>`;

/**
 * Launch the Excalidraw exporter. Returns an object with:
 *   - exportScene(scene, { dark }): Promise<string|null>  — SVG string, or null if no live elements
 *   - close(): Promise<void>  — shut down the browser
 *
 * Throws if Chromium cannot launch or the library fails to load within 60s.
 */
export async function makeExporter() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Load Excalidraw from esm.sh; waitUntil:'networkidle' lets the module finish loading.
  await page.setContent(BOOT_HTML, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.ExcalidrawLib?.exportToSvg', { timeout: 60000 });

  /**
   * Export a single scene as SVG.
   * @param {object} scene  Parsed Excalidraw scene (from readExcalidrawScene)
   * @param {{ dark: boolean }} opts
   * @returns {Promise<string|null>}  SVG XML string, or null if there are no live elements
   */
  async function exportScene(scene, { dark }) {
    return page.evaluate(
      async ({ scene, dark }) => {
        // Filter deleted elements before export
        const live = (scene.elements || []).filter((e) => !e.isDeleted);
        if (live.length === 0) return null;

        const svg = await window.ExcalidrawLib.exportToSvg({
          elements: live,
          appState: {
            ...scene.appState,
            exportBackground: true,
            exportWithDarkMode: dark
          },
          files: scene.files || {}
        });
        return new XMLSerializer().serializeToString(svg);
      },
      { scene, dark }
    );
  }

  return {
    exportScene,
    close: () => browser.close()
  };
}
