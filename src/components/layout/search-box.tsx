'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const RECENTS_KEY = 'velvet.recent-searches.v1';
const MAX_RECENTS = 8;
/** Live refinement only kicks in past this length — 1–2 letters match everything. */
const LIVE_MIN_LENGTH = 3;

function readRecents(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Global search field.
 *
 * Searching hits our own SQLite index (`/api/tube/videos?q=`), so there is no
 * per-keystroke cost to defend against — but live refinement is still limited to
 * the results page, because rewriting the URL on every character elsewhere would
 * push a history entry per keystroke. Off the results page navigation waits for an
 * explicit submit.
 */
export function SearchBox({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const onResultsPage = pathname === routes.tube.index;
  const urlQuery = onResultsPage ? (params.get('q') ?? '') : '';

  const [value, setValue] = React.useState(urlQuery);
  const [recents, setRecents] = React.useState<string[]>([]);
  const [showRecents, setShowRecents] = React.useState(false);
  const debounced = useDebouncedValue(value, 600);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Adopt the URL as the source of truth on navigation (back button, shared link).
  React.useEffect(() => setValue(urlQuery), [urlQuery]);
  React.useEffect(() => setRecents(readRecents()), []);

  const remember = React.useCallback((term: string) => {
    const next = [term, ...readRecents().filter((item) => item !== term)].slice(0, MAX_RECENTS);
    setRecents(next);
    try {
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      /* Storage unavailable — recents are a convenience, not a requirement. */
    }
  }, []);

  const go = React.useCallback(
    (term: string, options: { replace?: boolean; remember?: boolean } = {}) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      if (options.remember !== false) remember(trimmed);
      const href = routes.tube.filtered({ q: trimmed });
      if (options.replace) router.replace(href, { scroll: false });
      else router.push(href);
    },
    [remember, router],
  );

  // Live refinement, results page only.
  React.useEffect(() => {
    if (!onResultsPage) return;
    const trimmed = debounced.trim();
    if (trimmed.length < LIVE_MIN_LENGTH || trimmed === urlQuery.trim()) return;
    go(trimmed, { replace: true, remember: false });
  }, [debounced, onResultsPage, urlQuery, go]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setShowRecents(false);
    inputRef.current?.blur();
    go(value);
  };

  const suggestions = React.useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    const pool = trimmed ? recents.filter((item) => item.toLowerCase().includes(trimmed)) : recents;
    return pool.slice(0, 6);
  }, [recents, value]);

  return (
    <form role="search" onSubmit={onSubmit} className={cn('relative w-full', className)}>
      <label htmlFor="velvet-search" className="sr-only">
        Search videos
      </label>
      <div className="panel flex h-11 items-center gap-2 rounded-pill pl-4 pr-1.5 shadow-soft transition-shadow focus-within:shadow-glow">
        <Search className="size-4 shrink-0 text-foreground-subtle" aria-hidden />
        <input
          id="velvet-search"
          ref={inputRef}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setShowRecents(true)}
          // Blur fires before a mousedown on the list, so defer closing.
          onBlur={() => window.setTimeout(() => setShowRecents(false), 120)}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search videos, models, tags…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-subtle"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              inputRef.current?.focus();
            }}
            className="rounded-full p-1.5 text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label="Search"
          className="brand-gradient grid size-8 shrink-0 place-items-center rounded-full text-primary-foreground transition-transform duration-200 ease-spring hover:scale-105 active:scale-95"
        >
          <Search className="size-4" aria-hidden />
        </button>
      </div>

      {showRecents && suggestions.length > 0 ? (
        <ul
          className="panel-raised absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 animate-slide-down overflow-hidden rounded-card p-1.5 shadow-lifted"
          aria-label="Recent searches"
        >
          {suggestions.map((term) => (
            <li key={term}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setValue(term);
                  setShowRecents(false);
                  go(term);
                }}
                className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <Search className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
                <span className="truncate">{term}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
