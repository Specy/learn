// @ts-nocheck
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vaultPlugin } from './vite-plugin-vault.js';
import { searchIndexPlugin } from './vite-plugin-search-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = path.resolve(__dirname, 'notes', 'it');

export default defineConfig({
  plugins: [vaultPlugin(), searchIndexPlugin(), sveltekit()],
  server: { fs: { allow: [__dirname, VAULT_DIR] } },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts,mjs}', '*.{test,spec}.{js,ts,mjs}', 'scripts/**/*.{test,spec}.{js,ts,mjs}'],
    environment: 'node',
    testTimeout: 30000
  }
});
