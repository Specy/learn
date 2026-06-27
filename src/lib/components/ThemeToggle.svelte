<script lang="ts">
  import { themeState, toggleTheme } from '$lib/theme.svelte';
  import Icon from './Icon.svelte';
</script>

<button onclick={toggleTheme} aria-label="Toggle theme" class="theme-toggle">
  <Icon name={themeState.name === 'dark' ? 'sun' : 'moon'} size={18} />
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.1rem;
    height: 2.1rem;
    border: none;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--secondary) 70%, transparent);
    color: var(--background-text);
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s;
  }
  .theme-toggle:hover {
    background: color-mix(in srgb, var(--secondary) 100%, transparent);
    box-shadow: 0 2px 8px var(--shadow-color);
  }
</style>
