<script lang="ts">
  import type { Author } from '$lib/content/types';
  let { authors = [] }: { authors?: Author[] } = $props();
</script>

{#if authors.length}
  <div class="authors">
    {#each authors as a (a.name + (a.link ?? ''))}
      {#if a.link}
        <a class="author" href={a.link} target="_blank" rel="noopener noreferrer" title={a.name}>
          {#if a.image}<img class="author-img" src={a.image} alt="" loading="lazy" />{/if}
          <span class="author-name">{a.name}</span>
        </a>
      {:else}
        <span class="author" title={a.name}>
          {#if a.image}<img class="author-img" src={a.image} alt="" loading="lazy" />{/if}
          <span class="author-name">{a.name}</span>
        </span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .authors {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.9rem;
  }
  .author {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    max-width: 14rem;
    padding: 0.2rem 0.7rem 0.2rem 0.3rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent2) 22%, transparent);
    border: 1px solid var(--accent2);
    color: var(--background-text);
    font-size: 0.85rem;
    text-decoration: none;
    transition: border-color 0.15s, background 0.15s;
  }
  /* No avatar → even horizontal padding. */
  .author:not(:has(.author-img)) {
    padding-left: 0.7rem;
  }
  a.author:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  .author-img {
    flex: none;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    object-fit: cover;
  }
  .author-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
