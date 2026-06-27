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
  import SearchModal from '$lib/components/SearchModal.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { t } from '$lib/i18n';
  import { searchClient } from '$lib/search/searchClient.svelte';

  let { children } = $props();
  let sidebarOpen = $state(false);
  let searchOpen = $state(false);

  // Keyboard-shortcut hint (Cmd on Apple, Ctrl elsewhere); resolved on mount.
  let isMac = $state(false);
  const shortcut = $derived(isMac ? '⌘K' : 'Ctrl K');

  // Derive current language
  const lang = $derived(page.url.pathname.split('/').filter(Boolean)[0] ?? 'it');

  // Close overlays when navigating to a new path
  $effect(() => {
    const _path = page.url.pathname;
    sidebarOpen = false;
    searchOpen = false;
  });

  function onWindowKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      searchOpen = !searchOpen;
    }
  }

  onMount(() => {
    hydrateTheme();
    isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
    // Warm the search index on visit so the first search is instant.
    searchClient.sync().catch(() => {});
  });
</script>

<svelte:window onkeydown={onWindowKeydown} />

<Background>
  <button
    class="menu-toggle"
    onclick={() => sidebarOpen = !sidebarOpen}
    aria-label="Toggle navigation menu"
    aria-expanded={sidebarOpen}
  >
    <Icon name={sidebarOpen ? 'x' : 'menu'} size={22} />
  </button>

  <button
    class="search-toggle"
    onclick={() => (searchOpen = true)}
    aria-label={t(lang, 'search.button')}
  >
    <Icon name="search" size={20} />
    <span class="search-tip">{t(lang, 'search.button')} <kbd>{shortcut}</kbd></span>
  </button>

  <Sidebar bind:open={sidebarOpen} {lang} />
  <SearchModal bind:open={searchOpen} {lang} />

  <Nav />
  <PageTransition>
    {@render children?.()}
  </PageTransition>
  <Footer />
</Background>

<style>
  .menu-toggle,
  .search-toggle {
    position: fixed;
    top: 1.5rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: var(--glass-2);
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

  .menu-toggle {
    left: 1.5rem;
  }
  .search-toggle {
    left: 4.5rem;
  }

  .menu-toggle:hover,
  .search-toggle:hover {
    background: var(--glass-3);
  }

  /* Shortcut hint, shown below the search button on hover/focus. */
  .search-tip {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
    padding: 0.3rem 0.55rem;
    border-radius: 0.5rem;
    background: var(--secondary);
    border: 1px solid var(--accent2);
    box-shadow: 0 4px 12px var(--shadow-color);
    color: var(--background-text);
    font-family: var(--heading-font), sans-serif;
    font-size: 0.75rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s, transform 0.15s;
  }
  .search-tip kbd {
    font-family: var(--code-font), monospace;
    font-size: 0.68rem;
    padding: 0.05rem 0.3rem;
    border-radius: 0.3rem;
    background: color-mix(in srgb, var(--background-text) 12%, transparent);
  }
  .search-toggle:hover .search-tip,
  .search-toggle:focus-visible .search-tip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  /* No hover affordance on touch — hide the tip there. */
  @media (hover: none) {
    .search-tip {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .menu-toggle,
    .search-toggle {
      top: 1rem;
    }
    .menu-toggle {
      left: 1rem;
    }
    .search-toggle {
      left: 4rem;
    }
  }
</style>


