import { THEMES, DEFAULT_THEME, THEME_IDS, THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Blocking inline script that applies the stored theme *before* first paint.
 *
 * Without this the page renders with the default palette and then snaps to the
 * user's choice — the classic "theme flash". It is intentionally tiny, dependency
 * free, and generated from the theme registry so it can never drift from it.
 */
export function ThemeScript() {
  const colors = Object.fromEntries(THEMES.map((theme) => [theme.id, theme.themeColor]));

  const source = `(function(){try{
var ids=${JSON.stringify(THEME_IDS)};
var stored=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var theme=ids.indexOf(stored)>-1?stored:${JSON.stringify(DEFAULT_THEME)};
document.documentElement.setAttribute('data-theme',theme);
var meta=document.querySelector('meta[name="theme-color"]');
var color=(${JSON.stringify(colors)})[theme];
if(meta&&color)meta.setAttribute('content',color);
}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`;

  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: source }} />;
}
