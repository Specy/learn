<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page } from '$app/state';
  let { children }: { children?: import('svelte').Snippet } = $props();
</script>

{#key page.url.pathname}
  <div in:fly={{ duration: 1000, opacity: 0, y: -10 }} class="page">
    {@render children?.()}
  </div>
{/key}

<style>
  .page {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
</style>
