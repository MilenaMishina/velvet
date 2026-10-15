'use client';

import { Palette } from 'lucide-react';

import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { DEFAULT_THEME, THEMES, type ThemeId, themeDefinition } from '@/lib/theme';

/**
 * Theme picker.
 *
 * Cycles through Midnight / Paper / Glass. Swapping the theme writes a single
 * `data-theme` attribute (see `ThemeProvider`), and a `ThemeScript` ensures the
 * stored value is applied before first paint so there is never a flash of wrong
 * colour.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme, ready } = useTheme();
  const current = themeDefinition(ready ? theme : DEFAULT_THEME);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Change theme (current: ${current.label})`}
          className={cn('text-foreground-muted', className)}
        >
          <Palette aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(next) => setTheme(next as ThemeId)}
        >
          {THEMES.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id} className="gap-3 py-2.5">
              {/* Two-stop swatch so the choice is visible without a tooltip. */}
              <span
                aria-hidden
                className="size-4 shrink-0 rounded-full ring-1 ring-border"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${item.swatch[0]}, ${item.swatch[1]})`,
                }}
              />
              <div className="min-w-0">
                <p className="font-medium leading-none">{item.label}</p>
                <p className="mt-1 text-2xs leading-snug text-foreground-subtle">{item.description}</p>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
