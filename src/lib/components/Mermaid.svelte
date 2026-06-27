<!-- app/src/lib/components/Mermaid.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import mermaid from 'mermaid';

  import type { MermaidConfig } from 'mermaid';
  let { code, theme = 'default' }: { code: string; theme?: MermaidConfig['theme'] } = $props();

  let svg = $state('');
  let error = $state<string | null>(null);

  const base = `mmd-${Math.random().toString(36).slice(2)}`;
  let n = 0;

  $effect(() => {
    const _c = code;
    const _t = theme;
    if (!browser || !_c) return;

    let cancelled = false;
    (async () => {
      try {
        error = null;
        mermaid.initialize({ startOnLoad: false, theme: _t, securityLevel: 'loose' });
        const { svg: out } = await mermaid.render(`${base}-${n++}`, _c);
        if (!cancelled) svg = out;
      } catch (e) {
        if (!cancelled) error = e instanceof Error ? e.message : String(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  });
</script>

{#if error}
  <pre class="mermaid-error">{error}</pre>
{:else}
  <div class="mermaid">{@html svg}</div>
{/if}
