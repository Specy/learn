import { describe, it, expect } from 'vitest';
import { nextTheme, THEMES } from './theme.svelte';
describe('theme', () => {
  it('toggles between dark and light', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
  it('uses the spec palette (specy.app accent)', () => {
    expect(THEMES.dark['--accent']).toBe('#a65ee0');
    expect(THEMES.light['--accent']).toBe('#da0363');
  });
});
