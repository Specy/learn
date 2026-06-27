<script lang="ts">
  let { breadcrumbs, current }:
    { breadcrumbs: { title: string; url: string }[]; current: string } = $props();

  // Combined segments: ancestor crumbs + the current page (no link).
  const segs = $derived([
    ...breadcrumbs.map((b) => ({ title: b.title, url: b.url })),
    { title: current, url: null as string | null },
  ]);
  const courseIndex = 1; // never ellipsized

  // Accent ramps left→right: leftmost 0%, ancestors interpolate up to 50%,
  // the last (current) crumb jumps to 90%.
  function accentPct(i: number, n: number): number {
    if (i === n - 1) return 90;
    const lastAncestor = n - 2;
    return lastAncestor <= 0 ? 0 : (i / lastAncestor) * 50;
  }
  function segStyle(i: number, n: number): string {
    const pct = accentPct(i, n);
    const bg = `color-mix(in srgb, var(--accent) ${pct}%, var(--secondary))`;
    const color = pct >= 45 ? '#fff' : 'var(--background-text)';
    return `background:${bg}; color:${color}; z-index:${n - i};${i > 0 ? ' margin-left:-0.7rem;' : ''}`;
  }
</script>

<nav aria-label="Breadcrumb" class="breadcrumbs">
  <ol>
    {#each segs as seg, i}
      <li
        class="seg"
        class:first={i === 0}
        class:last={i === segs.length - 1}
        class:keep={i === courseIndex}
        style={segStyle(i, segs.length)}
      >
        {#if seg.url}
          <a class="label" href={seg.url}>{seg.title}</a>
        {:else}
          <span class="label" aria-current="page">{seg.title}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .breadcrumbs {
    padding: 0.25rem 1rem 1rem;
  }
  /* One continuous pill: rounded outer ends (overflow clips first/last). */
  ol {
    list-style: none;
    display: inline-flex;
    flex-wrap: nowrap;
    align-items: stretch;
    margin: 0;
    padding: 0;
    max-width: 100%;
    border-radius: 999px;
    overflow: hidden;
    font-size: 1rem; /* reset: parent .article sets 1.2rem */
  }

  .seg {
    position: relative;
    display: flex;
    max-width: 9rem;
    align-items: center;
    /* middle segments: notch-left + point-right (interlocking arrows) */
    padding: 0.3rem 0.85rem 0.3rem 1.15rem;
    clip-path: polygon(
      0 0,
      calc(100% - 0.7rem) 0,
      100% 50%,
      calc(100% - 0.7rem) 100%,
      0 100%,
      0.7rem 50%
    );
  }
  /* First: straight left (the pill rounds it), point-right. */
  .seg.first {
    padding-left: 0.95rem;
    clip-path: polygon(0 0, calc(100% - 0.7rem) 0, 100% 50%, calc(100% - 0.7rem) 100%, 0 100%);
  }
  /* Last: notch-left, straight right (the pill rounds it). */
  .seg.last {
    padding-right: 1rem;
    max-width: unset;
    overflow: hidden;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0.7rem 50%);
  }
  /* A breadcrumb with no ancestors would be both first and last → plain pill. */
  .seg.first.last {
    clip-path: none;
  }

  .label {
    display: block;
    max-width: 14rem;
    font-family: var(--heading-font), sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    color: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .seg.keep .label {
    max-width: none; /* course name never truncated */
  }
  a.label:hover {
    text-decoration: underline;
  }
</style>
