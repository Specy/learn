<script lang="ts">
  import { t } from '$lib/i18n';
  import Button from './Button.svelte';
  let { prev, next, lang = 'it' }: {
    prev: { title: string; path: string } | null;
    next: { title: string; path: string } | null;
    lang?: string;
  } = $props();
</script>

{#if prev || next}
  <nav aria-label="Note navigation" class="note-nav">
    {#if prev}
      <Button href={prev.path}>
        <span class="dir">{t(lang, 'note.prev')}</span>
        <span class="title">{prev.title}</span>
      </Button>
    {:else}
      <span></span>
    {/if}
    {#if next}
      <Button href={next.path} align="end">
        <span class="dir">{t(lang, 'note.next')}</span>
        <span class="title">{next.title}</span>
      </Button>
    {/if}
  </nav>
{/if}

<style>
  .note-nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    margin-top: 3rem;
  }

  /* Shared button overrides */
  .note-nav :global(.btn) {
    flex:1;
    min-width: min(calc(100vw - 1rem), 20rem);
    flex-direction: column;
    gap: 0.15rem;
  }

  /* Prev arrow: left-pointing notch */
  .note-nav :global(.btn.start) {
    align-items: flex-start;
    padding: 0.6rem 1.2rem 0.6rem 1.8rem;
    background: linear-gradient(to left, var(--secondary) 60%, color-mix(in srgb, var(--accent) 20%, var(--secondary)));
    clip-path: polygon(
      1rem 0,
      100% 0,
      100% 100%,
      1rem 100%,
      0 50%
    );
  }

  /* Next arrow: right-pointing tip */
  .note-nav :global(.btn.end) {
    align-items: flex-end;
    text-align: right;
    padding: 0.6rem 1.8rem 0.6rem 1.2rem;
    background: linear-gradient(to right, color-mix(in srgb, var(--secondary) 50%, transparent) 60%, color-mix(in srgb, var(--accent) 20%, var(--secondary)));
    clip-path: polygon(
      0 0,
      calc(100% - 1rem) 0,
      100% 50%,
      calc(100% - 1rem) 100%,
      0 100%
    );
  }

  .dir {
    font-weight: 500;
    margin-bottom: 0.5rem;
  }
  .title {
    color: var(--muted);
    font-size: 0.9rem;
  }
</style>
