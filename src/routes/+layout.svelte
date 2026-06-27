<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import 'katex/dist/katex.min.css';
  import '../app.css';
  import { hydrateTheme } from '$lib/theme.svelte';
  import Background from '$lib/components/Background.svelte';
  import Nav from '$lib/components/Nav.svelte';
  import PageTransition from '$lib/components/PageTransition.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { children } = $props();
  let sidebarOpen = $state(false);

  // Derive current language
  const lang = $derived(page.url.pathname.split('/').filter(Boolean)[0] ?? 'it');

  // Close sidebar when navigating to a new path
  $effect(() => {
    const _path = page.url.pathname;
    sidebarOpen = false;
  });

  onMount(() => {
    hydrateTheme();
  });
</script>

<Background>
  <button
    class="menu-toggle"
    onclick={() => sidebarOpen = !sidebarOpen}
    aria-label="Toggle navigation menu"
    aria-expanded={sidebarOpen}
  >
    <Icon name={sidebarOpen ? 'x' : 'menu'} size={22} />
  </button>

  <Sidebar bind:open={sidebarOpen} {lang} />

  <Nav />
  <PageTransition>
    {@render children?.()}
  </PageTransition>
</Background>

<style>
  .menu-toggle {
    position: fixed;
    left: 1.5rem;
    top: 1.5rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: #52537a1a;
    backdrop-filter: blur(12px);
    border: 1px solid var(--accent2);
    box-shadow: 0 4px 12px var(--shadow-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--background-text);
    z-index: 100;
    transition: background-color 0.2s, transform 0.2s, border-color 0.2s;
    padding: 0;
  }

  .menu-toggle:hover {
    background: #52537a33;
  }

  @media (max-width: 1200px) {
    .menu-toggle {
      left: 1rem;
      top: 1rem;
    }
  }
</style>


