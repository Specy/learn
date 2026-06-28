<script lang="ts">
	import type { ContentNode } from '$lib/content/types';
	import Icon from './Icon.svelte';
	import SidebarTree from './SidebarTree.svelte';

	let {
		node,
		lang,
		activePath,
		onSelect
	}: {
		node: ContentNode;
		lang: string;
		activePath: string;
		onSelect: () => void;
	} = $props();

	let isFolder = $derived(node.kind === 'folder');
	let isRootCourse = $derived(isFolder && !node.path.includes('/'));
	let isActive = $derived(activePath === node.path || activePath.startsWith(node.path + '/'));
	let isOpen = $state(false);

	// Initialize folder open state based on active path
	$effect.pre(() => {
		if (isFolder && isActive) {
			isOpen = true;
		}
	});

	function toggleOpen() {
		isOpen = !isOpen;
	}
</script>

{#if isFolder}
	<div class="folder-item" class:is-root-course={isRootCourse} class:active={isActive}>
		<div
			class="folder-header"
			class:active={isActive}
			onclick={toggleOpen}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && toggleOpen()}
		>
			<span class="chevron-wrapper" class:rotated={isOpen}>
				<Icon name="chevron" size={14} />
			</span>
			<span class="folder-title" class:active={isActive}>
				{node.title}
			</span>
		</div>
		{#if isOpen}
			<ul class="folder-children" class:root-children={isRootCourse}>
				<li>
					<a
						href="/{lang}/{node.path}"
						class="note-link index-link"
						class:active={activePath === node.path}
						onclick={onSelect}
					>
						<span class="note-bullet"></span>
						<span class="note-title">{lang === 'it' ? 'Indice' : 'Index'}</span>
					</a>
				</li>
				{#each node.kind === 'folder' ? node.children : [] as child}
					<li>
						<SidebarTree node={child} {lang} {activePath} {onSelect} />
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{:else}
	<a
		href="/{lang}/{node.path}"
		class="note-link"
		class:active={activePath === node.path}
		onclick={onSelect}
	>
		<span class="order" class:active={activePath === node.path}>
			{String(node.order).padStart(2, '0')}
		</span>
		<span class="note-title">{node.title}</span>
	</a>
{/if}

<style>
	.folder-item {
		font-family: var(--heading-font);
		display: flex;
		background: color-mix(in srgb, var(--secondary) 60%, transparent);
		border-radius: 0.4rem;
		flex-direction: column;
		margin: 0.4rem 0;
	}

	/* Card styling for top level courses */
	.folder-item.is-root-course {
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--secondary) 30%, transparent);
		margin-bottom: 0.75rem;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
		transition:
			border-color 0.2s,
			background-color 0.2s;
	}

	.order {
		font-family: Rubik;
		padding: 0.25ch 1ch;
		min-width: 4ch;
		background-color: var(--background);
		border-radius: 1rem;
		text-align: center;
		margin-right: 1rem;
	}

	.order.active {
		background-color: var(--accent);
		color: var(--background);
	}

	.folder-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		cursor: pointer;
		user-select: none;
		padding: 0.8rem;
		border-radius: 0.3rem;
		transition: background-color 0.2s;
	}

	.folder-header.active {
		background-color: rgba(255, 255, 255, 0.03);
		border-bottom: 1px solid var(--background);
	}

	.folder-header:hover {
		background-color: rgba(255, 255, 255, 0.03);
	}

	.chevron-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.chevron-wrapper.rotated {
		transform: rotate(90deg);
	}

	.folder-title {
		font-size: 0.95rem;
		font-weight: 600;
		font-family: var(--heading-font), sans-serif;
		color: var(--background-text);
		transition: color 0.2s;
	}

	.folder-title.active {
		color: var(--accent);
	}

	.is-root-course > .folder-header .folder-title {
		font-size: 1.05rem;
		font-weight: 700;
	}

	.folder-children {
		list-style: none;
		margin: 0 0.4rem;
		padding: 0rem;
	}

	.folder-children li {
		margin: 0;
		padding: 0;
	}

	.note-link {
		display: flex;
		align-items: center;
		padding: 0.4rem 0.6rem;
		color: var(--muted);
		font-size: 0.9rem;
		border-radius: 0.3rem;
		transition:
			color 0.2s,
			background-color 0.2s;
		text-decoration: none;
		margin: 0.15rem 0;
	}

	.note-link:hover {
		color: var(--background-text);
		background-color: rgba(255, 255, 255, 0.05);
	}

	.note-link.active {
		color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 12%, transparent);
		font-weight: 500;
	}

	.note-link.index-link {
		font-style: italic;
		opacity: 0.9;
	}

	.note-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
