<script lang="ts">
  import { page } from '$app/state';

  const LANGUAGES = [
    { code: 'it', label: 'IT' },
    { code: 'en', label: 'EN' },
  ] as const;

  // Derive the current language from the first path segment, default to 'it'
  const currentLang = $derived(page.url.pathname.split('/').filter(Boolean)[0] ?? 'it');

  // Build the target URL by swapping the first path segment
  function urlFor(lang: string): string {
    const parts = page.url.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return `/${lang}`;
    parts[0] = lang;
    return '/' + parts.join('/');
  }
</script>

<nav class="lang-switcher" aria-label="Language switcher">
  {#each LANGUAGES as lang}
    <a
      href={urlFor(lang.code)}
      class="lang-link"
      class:active={currentLang === lang.code}
      aria-current={currentLang === lang.code ? 'page' : undefined}
    >
      {lang.label}
    </a>
  {/each}
</nav>

<style>
  .lang-switcher {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .lang-link {
    font-family: var(--heading-font, sans-serif);
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
    color: var(--hint);
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
    letter-spacing: 0.05em;
  }

  .lang-link:hover {
    color: var(--background-text);
  }

  .lang-link.active {
    color: var(--accent);
  }
</style>
