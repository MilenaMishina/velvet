/**
 * Theme registry.
 *
 * Themes are pure data: the id becomes `data-theme` on <html>, and every visual
 * difference lives in CSS variables (see `app/globals.css`). That keeps switching
 * to a single attribute write — no class churn, no re-render of the tree.
 */

export const THEME_IDS = ['obsidian', 'midnight', 'paper', 'glass'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'obsidian';

/**
 * NOTE: the ids are stable — `obsidian` has shipped since the first release and
 * lives in visitors' localStorage. Only labels and palettes change freely.

/** localStorage key. Versioned so a token rename can't resurrect a dead value. */
export const THEME_STORAGE_KEY = 'velvet.theme.v1';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  /** Drives the browser UI colour (`<meta name="theme-color">`). */
  themeColor: string;
  /** Two-stop swatch shown in the theme picker. */
  swatch: [string, string];
}

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'obsidian',
    label: 'Velvet Noir',
    description: 'Velvet black heated by crimson and amber — the house look',
    themeColor: '#080507',
    swatch: ['#120a0e', '#ef2069'],
  },
  {
    id: 'midnight',
    label: 'Bordeaux',
    description: 'Wine-black lit by magenta rose',
    themeColor: '#0a040a',
    swatch: ['#170a17', '#e04bbf'],
  },
  {
    id: 'paper',
    label: 'Daylight',
    description: 'Bright, warm and easy on the eyes',
    themeColor: '#f7f2ef',
    swatch: ['#faf6f2', '#d61f5c'],
  },
  {
    id: 'glass',
    label: 'Rouge Glass',
    description: 'Frosted rose panels over deep plum',
    themeColor: '#0a0410',
    swatch: ['#1a0c26', '#e17ce8'],
  },
] as const;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function themeDefinition(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]!;
}
