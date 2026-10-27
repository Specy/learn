<!-- app/src/lib/components/RenderedMarkdown.svelte -->
<script lang="ts">
	import { browser } from '$app/environment';
	import { themeState } from '$lib/theme.svelte';
	import { mount, unmount } from 'svelte';
	import Mermaid from './Mermaid.svelte';

	let { html }: { html: string } = $props();

	/**
	 * Open/close a foldable callout by animating its height (as specy.app does for
	 * sidetracks). While closing, the content stays visible and `data-closing`
	 * turns the chevron; `folded` is only applied once the animation ends.
	 */
	function toggleFold(c: HTMLElement) {
		const opening = c.classList.contains('folded') || c.hasAttribute('data-closing');
		c.getAnimations().forEach((a) => a.cancel());
		c.removeAttribute('data-closing');
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			c.classList.toggle('folded', !opening);
			return;
		}
		const start = c.getBoundingClientRect().height;
		c.classList.add('folded');
		const closed = c.getBoundingClientRect().height;
		c.classList.remove('folded');
		const open = c.getBoundingClientRect().height;
		if (!opening) c.setAttribute('data-closing', '');
		const animation = c.animate(
			{ height: [`${start}px`, `${opening ? open : closed}px`] },
			{ duration: 200, easing: 'ease' }
		);
		animation.onfinish = () => {
			if (!opening) c.classList.add('folded');
			c.removeAttribute('data-closing');
		};
	}

	let el: HTMLElement;

	$effect(() => {
		const _t = themeState.name;
		const _html = html;
		if (!browser || !el) return;

		const mermaidTheme = _t === 'dark' ? 'dark' : 'default';

		// Replace .mermaid-src blocks with mounted Mermaid components.
		// Diagrams are (re)mounted each time this effect re-runs (on html or theme
		// change). mount() props are not reactive, so remounting is the correct
		// approach for picking up new html content and theme changes.
		const instances: ReturnType<typeof mount>[] = [];
		el.querySelectorAll<HTMLPreElement>('pre.mermaid-src').forEach((pre) => {
			const code = pre.textContent ?? '';
			const host = document.createElement('div');
			pre.replaceWith(host);
			instances.push(mount(Mermaid, { target: host, props: { code, theme: mermaidTheme } }));
		});

		// Wire foldable callouts. Guard with dataset to avoid duplicate listeners.
		el.querySelectorAll<HTMLElement>('.callout[data-callout-fold]').forEach((c) => {
			if (c.dataset.foldWired) return;
			c.dataset.foldWired = '1';
			// Start closed if fold value is 'closed'
			if (c.dataset.calloutFold === 'closed') c.classList.add('folded');
			const title = c.querySelector('.callout-title');
			title?.addEventListener('click', () => toggleFold(c));
		});

		return () => {
			instances.forEach((inst) => unmount(inst));
			instances.length = 0;
		};
	});
</script>

<div class="md" bind:this={el}>{@html html}</div>
