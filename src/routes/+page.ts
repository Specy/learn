import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
export const prerender = true;
export const load: PageLoad = () => {
	redirect(308, '/it');
};
// redirect() during prerender emits a static meta-refresh page automatically.
