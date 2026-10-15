/**
 * Theme registry.
 *
 * Themes are pure data: the id becomes `data-theme` on <html>, and every visual
 * difference lives in CSS variables (see `app/globals.css`). That keeps switching
 * to a single attribute write — no class churn, no re-render of the tree.
 */

export const THEME_IDS = ['midnight', 'paper', 'glass'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'midnight';

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
    id: 'midnight',
    label: 'Noir',
    description: 'Near-black with an icy blue glow',
    themeColor: '#04060c',
    swatch: ['#0a1222', '#3b82f6'],
  },
  {
    id: 'paper',
    label: 'Daylight',
    description: 'Bright, warm and easy on the eyes',
    themeColor: '#f7f4ef',
    swatch: ['#faf7f2', '#2563eb'],
  },
  {
    id: 'glass',
    label: 'Glass',
    description: 'Frosted panels over deep blue',
    themeColor: '#04070f',
    swatch: ['#0d1a31', '#60a5fa'],
  },
] as const;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function themeDefinition(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]!;
}
