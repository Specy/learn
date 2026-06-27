// app/svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build', assets: 'build',
      fallback: undefined, precompress: false, strict: true
    }),
    paths: { base: '' },
    // handleUnseenRoutes: 'warn' surfaces genuinely-unreachable routes in build logs
    // without hard-failing. 'ignore' was used only during the content-empty interim.
    prerender: { entries: ['*'], handleHttpError: 'warn', handleMissingId: 'warn', handleUnseenRoutes: 'warn' }
  }
};
export default config;
