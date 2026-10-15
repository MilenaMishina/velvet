'use client';

import * as React from 'react';

import { DEFAULT_THEME, isThemeId, THEME_STORAGE_KEY, type ThemeId, themeDefinition } from '@/lib/theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  /** False until the stored preference has been read, so UI can avoid guessing. */
  ready: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/**
 * Theme state.
 *
 * `ThemeScript` already set `data-theme` before paint; this provider just mirrors
 * that value into React, persists changes, and keeps other tabs in sync.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeId>(DEFAULT_THEME);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (isThemeId(fromDom)) setThemeState(fromDom);
    setReady(true);
  }, []);

  const apply = React.useCallback((next: ThemeId) => {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', themeDefinition(next).themeColor);
  }, []);

  const setTheme = React.useCallback(
    (next: ThemeId) => {
      apply(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* Private-mode storage denial must not break theming for this session. */
      }
    },
    [apply],
  );

  // Keep every open tab on the same theme.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && isThemeId(event.newValue)) apply(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [apply]);

  const value = React.useMemo<ThemeContextValue>(() => ({ theme, setTheme, ready }), [theme, setTheme, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return context;
}
