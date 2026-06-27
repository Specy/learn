<script lang="ts">
	import { page } from "$app/state"
	import { fade } from "svelte/transition"
	import { files } from "virtual:vault"
	import { buildTree } from "$lib/content/tree"
	import SidebarTree from "./SidebarTree.svelte"

	let { open = $bindable(), lang }: { open: boolean; lang: string } = $props()

	const rootNode = buildTree(files)

	// Parse path to pass to children for highlighting
	const pathname = $derived(page.url.pathname)
	const segments = $derived(pathname.split("/").filter(Boolean))
	const activePath = $derived(segments.slice(1).join("/"))

	// Sort course children putting the active course first
	const sortedChildren = $derived(
		(() => {
			const children = [...rootNode.children]
			const courseSlug = activePath.split("/")[0]
			if (courseSlug) {
				const idx = children.findIndex((c) => c.slug === courseSlug)
				if (idx > 0) {
					const [activeItem] = children.splice(idx, 1)
					children.unshift(activeItem)
				}
			}
			return children
		})(),
	)

	function closeSidebar() {
		open = false
	}
</script>

{#if open}
	<!-- Backdrop overlay with dim only (no blur) -->
	<div
		class="sidebar-backdrop"
		onclick={closeSidebar}
		transition:fade={{ duration: 200 }}
		role="presentation"
	></div>
{/if}

<!-- Sidebar panel -->
<aside class="sidebar" class:open>
	<div class="sidebar-content">
		<nav class="sidebar-nav" aria-label="Course Navigation">
			<ul class="root-list">
				{#each sortedChildren as child}
					<li>
						<SidebarTree
							node={child}
							{lang}
							{activePath}
							onSelect={closeSidebar}
						/>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
</aside>

<style>
	/* Backdrop overlay (dim background only, no blur) */
	.sidebar-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 95;
		cursor: pointer;
	}

	/* Sidebar container styles (wider, mostly opaque, with backdrop blur) */
	.sidebar {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		width: min(95vw, 30rem);
		z-index: 99;
		background: color-mix(in srgb, var(--background) 80%, #52537a1a);
		backdrop-filter: blur(8px);
		border-right: 1px solid var(--accent2);
		box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		transform: translateX(-100%);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.sidebar.open {
		transform: translateX(0);
	}
	.sidebar-title {
		font-family: var(--heading-font), sans-serif;
		font-weight: 800;
		font-size: 1.25rem;
		color: var(--background-text);
	}

	/* Content area (scrollable) */
	.sidebar-content {
		flex-grow: 1;
		overflow-y: scroll;
		padding: 1.5rem 1rem 3rem 1.25rem;
		scrollbar-width: thin;
		scrollbar-color: var(--accent2) transparent;
		padding-top: 5rem;
	}

	.sidebar-content::-webkit-scrollbar {
		width: 4px;
	}

	.sidebar-content::-webkit-scrollbar-thumb {
		background-color: var(--accent2);
		border-radius: 4px;
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.root-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	.root-list li {
		margin: 0;
		padding: 0;
	}

	@media screen and (min-width: 763px) {
		.sidebar-content {
			padding-top: 5rem;
		}
	}
</style>
