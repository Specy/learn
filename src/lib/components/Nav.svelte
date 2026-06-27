<script lang="ts">
  import { page } from '$app/state';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import Logo from '$lib/components/Logo.svelte';

  // Derive lang from the first path segment; fall back to 'it'
  const lang = $derived(page.url.pathname.split('/').filter(Boolean)[0] ?? 'it');
</script>

<header class="nav">
  <Logo {lang} />
  <div class="nav-controls">
    <LanguageSwitcher />
    <ThemeToggle />
  </div>
</header>

<style>
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 1.5rem 1.5rem 5rem;
  }

  @media (max-width: 1200px) {
    .nav {
      padding: 1rem 1rem 1rem 4rem;
    }
  }

  .nav-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
</style>
