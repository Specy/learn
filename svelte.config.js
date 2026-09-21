// app/svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		}),
		// Absolute asset URLs (`/_app/...`). SvelteKit defaults `relative` to true, which
		// breaks any page served at a URL other than the one it was prerendered for —
		// notably 404.html, which Cloudflare Pages serves at arbitrary depths. The site
		// lives at a subdomain root, so absolute paths are always correct here.
		paths: { base: '', relative: false },
		// handleUnseenRoutes: 'warn' surfaces genuinely-unreachable routes in build logs
		// without hard-failing. 'ignore' was used only during the content-empty interim.
		prerender: {
			entries: ['*'],
			handleHttpError: 'warn',
			handleMissingId: 'warn',
			handleUnseenRoutes: 'warn'
		}
	}
};
export default config;
