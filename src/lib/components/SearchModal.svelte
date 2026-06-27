<script lang="ts">
  import { tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import Icon from '$lib/components/Icon.svelte';
  import { searchClient } from '$lib/search/searchClient.svelte';
  import type { SearchContext, SearchResult } from '$lib/search/types';

  let { open = $bindable(), lang = 'it' }: { open: boolean; lang?: string } = $props();

  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let selected = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);

  // Throttle (live updates while typing — leading + trailing, not debounced).
  const THROTTLE_MS = 80;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRun = 0;
  let searchToken = 0;

  const spinning = $derived(searchClient.searching);
  const errored = $derived(searchClient.status === 'error');

  function currentContext(): SearchContext {
    const segs = page.url.pathname.split('/').filter(Boolean);
    return {
      lang: segs[0] || lang || 'it',
      course: segs[1] ?? '',
      notePath: segs.slice(1).join('/')
    };
  }

  async function runSearch() {
    const q = query.trim();
    if (!q) {
      results = [];
      return;
    }
    const token = ++searchToken;
    const r = await searchClient.search(q, currentContext());
    if (token === searchToken) {
      results = r;
      selected = 0;
    }
  }

  function onInput() {
    const now = performance.now();
    const since = now - lastRun;
    if (since >= THROTTLE_MS) {
      lastRun = now;
      void runSearch();
    } else if (!throttleTimer) {
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        lastRun = performance.now();
        void runSearch();
      }, THROTTLE_MS - since);
    }
  }

  async function scrollSelectedIntoView() {
    await tick();
    listEl?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function move(delta: number) {
    if (!results.length) return;
    selected = (selected + delta + results.length) % results.length;
    void scrollSelectedIntoView();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[selected];
      if (r) openResult(r);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function openResult(r: SearchResult) {
    close();
    void goto(r.url);
  }

  function close() {
    open = false;
  }

  function scopeLabel(r: SearchResult): string {
    if (r.scope === 'current') return t(lang, 'search.scope.current');
    if (r.scope === 'same-course') return t(lang, 'search.scope.course');
    return r.courseTitle || '—';
  }

  // When opened: warm the index, lock body scroll, focus the input.
  $effect(() => {
    if (!open) return;
    searchClient.sync().catch(() => {});
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void tick().then(() => inputEl?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  });
</script>

{#if open}
  <div
    class="backdrop"
    role="presentation"
    onclick={close}
    transition:fade={{ duration: 150 }}
  ></div>

  <div
    class="spotlight-wrap"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) close();
    }}
  >
    <div
      class="spotlight"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'search.button')}
      tabindex="-1"
      transition:scale={{ duration: 160, start: 0.97 }}
    >
      <div class="search-row">
        <Icon name="search" size={20} />
        <input
          bind:this={inputEl}
          bind:value={query}
          oninput={onInput}
          onkeydown={onKeydown}
          type="text"
          class="search-input"
          placeholder={t(lang, 'search.placeholder')}
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
        />
        {#if spinning}
          <span class="spinner" aria-hidden="true"></span>
        {/if}
      </div>

      {#if query.trim()}
        <ul class="results" bind:this={listEl} role="listbox">
          {#each results as r, i (r.url + i)}
            <li>
              <a
                href={r.url}
                class="result"
                class:is-file={r.kind === 'file'}
                class:selected={i === selected}
                data-selected={i === selected}
                role="option"
                aria-selected={i === selected}
                onclick={(e) => {
                  e.preventDefault();
                  openResult(r);
                }}
                onmouseenter={() => (selected = i)}
              >
                <span class="r-icon" class:accent={r.kind === 'file'}>
                  <Icon name={r.kind === 'file' ? 'file' : 'hash'} size={16} />
                </span>
                <span class="r-body">
                  {#if r.kind === 'file'}
                    <span class="r-title">{r.noteTitle}</span>
                  {:else}
                    <span class="r-crumb">
                      <span class="r-note">{r.noteTitle}</span>
                      <span class="r-sep">›</span>
                      <span class="r-heading">{r.heading}</span>
                    </span>
                    {#if r.snippet}<span class="r-snippet">{r.snippet}</span>{/if}
                  {/if}
                </span>
                <span class="chip chip-{r.scope}">{scopeLabel(r)}</span>
              </a>
            </li>
          {:else}
            {#if !spinning}
              <li class="msg">{errored ? t(lang, 'search.unavailable') : t(lang, 'search.noResults')}</li>
            {/if}
          {/each}
        </ul>
        <div class="hint">{t(lang, 'search.hint')}</div>
      {:else}
        <div class="empty">{t(lang, 'search.empty')}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(8, 9, 13, 0.45);
    backdrop-filter: blur(2px);
    z-index: 200;
  }
  .spotlight-wrap {
    position: fixed;
    inset: 0;
    z-index: 201;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 14vh 1rem 2rem;
    pointer-events: none;
  }
  /* Same glass language as the menu toggle, scaled up for a spotlight panel. */
  .spotlight {
    pointer-events: auto;
    width: min(92vw, 42rem);
    max-height: 72vh;
    display: flex;
    flex-direction: column;
    background: #52537a1a;
    backdrop-filter: blur(20px);
    border: 1px solid var(--accent2);
    box-shadow: 0 16px 48px var(--shadow-color);
    border-radius: 1rem;
    overflow: hidden;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.95rem 1.1rem;
    color: var(--muted);
    border-bottom: 1px solid var(--accent2);
  }
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--background-text);
    font-family: var(--heading-font), sans-serif;
    font-size: 1.15rem;
  }
  .search-input::placeholder {
    color: var(--muted);
  }

  .spinner {
    width: 1.05rem;
    height: 1.05rem;
    border: 2px solid var(--accent2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex: none;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 0.4rem;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--accent2) transparent;
  }

  .result {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.7rem;
    border-radius: 0.6rem;
    color: var(--background-text);
    cursor: pointer;
    border: 1px solid transparent;
  }
  .result.selected {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  }
  /* File-name hits read differently from in-page section hits. */
  .result.is-file {
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }
  .result.is-file.selected {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .r-icon {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.7rem;
    height: 1.7rem;
    border-radius: 0.45rem;
    background: color-mix(in srgb, var(--accent2) 60%, transparent);
    color: var(--muted);
  }
  .r-icon.accent {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--accent);
  }

  .r-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .r-title {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .r-crumb {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .r-note {
    color: var(--muted);
    font-size: 0.85rem;
    flex: none;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .r-sep {
    color: var(--muted);
    flex: none;
  }
  .r-heading {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .r-snippet {
    color: var(--muted);
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip {
    flex: none;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.18rem 0.5rem;
    border-radius: 1rem;
    white-space: nowrap;
    max-width: 9rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* --accent2 and --tertiary are dark in both themes, so chip text is always
     light (using --background-text would go dark-on-dark in the light theme). */
  .chip-current {
    background: var(--accent);
    color: #fff;
  }
  .chip-same-course {
    background: var(--accent2);
    color: #f2f2f2;
  }
  .chip-other {
    background: color-mix(in srgb, var(--tertiary) 88%, transparent);
    color: #f2f2f2;
  }

  .empty,
  .msg {
    padding: 1.4rem 1.2rem;
    color: var(--muted);
    text-align: center;
    list-style: none;
  }
  .hint {
    padding: 0.55rem 1rem;
    border-top: 1px solid var(--accent2);
    color: var(--muted);
    font-size: 0.72rem;
    text-align: center;
  }

  @media (max-width: 640px) {
    .spotlight-wrap {
      padding: 8vh 0.6rem 1rem;
    }
    .r-snippet {
      display: none;
    }
  }
</style>
