// app/src/lib/theme.svelte.ts — palette from the spec (specy.app)
import { browser } from '$app/environment';

type ThemeName = 'light' | 'dark';

export const THEMES: Record<ThemeName, Record<string, string>> = {
  dark: {
    '--background': '#171A21',
    '--secondary': '#212630',
    '--tertiary': '#2d3950',
    '--footer': '#1c2029',
    '--accent': '#a65ee0',
    '--accent2': '#38454f',
    '--hint': '#939393',
    '--warn': '#ed4f4f',
    '--success': '#356a59',
    '--background-text': '#d4d4d4',
    '--shadow-color': 'rgba(0,0,0,0.4)'
  },
  light: {
    '--background': '#fafafa',
    '--secondary': '#f6f6f6',
    '--tertiary': '#2d3950',
    '--footer': '#212121',
    '--accent': '#da0363',
    '--accent2': '#38454f',
    '--hint': '#939393',
    '--warn': '#ed4f4f',
    '--success': '#356a59',
    '--background-text': '#1a1a1a',
    '--shadow-color': 'rgba(0,0,0,0.15)'
  }
};

export const nextTheme = (n: ThemeName): ThemeName => (n === 'dark' ? 'light' : 'dark');

function initial(): ThemeName {
  if (!browser) return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export const themeState = $state<{ name: ThemeName }>({ name: initial() });

export function applyTheme(name: ThemeName) {
  themeState.name = name;
  if (!browser) return;
  const r = document.documentElement;
  r.setAttribute('data-theme', name);
  for (const [k, v] of Object.entries(THEMES[name])) r.style.setProperty(k, v);
  localStorage.setItem('theme', name);
}

export function toggleTheme() {
  applyTheme(nextTheme(themeState.name));
}

export function hydrateTheme() {
  applyTheme(initial());
}
