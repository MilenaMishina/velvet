'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Flame } from 'lucide-react';

import { AccountMenu, AccountMenuFallback } from '@/components/layout/account-menu';
import { SearchBox } from '@/components/layout/search-box';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { publicEnv } from '@/lib/env';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const PRIMARY = [
  { label: 'Home', href: routes.home },
  { label: 'All videos', href: routes.tube.index },
  { label: 'Trending', href: routes.trending },
  { label: 'Tags', href: routes.tags },
  { label: 'Sources', href: routes.sources },
] as const;

/** Exact match for `/`; prefix match elsewhere — but queries decide ties, so a
 *  plain `/videos` view and the trending view never both read as active. */
function isActive(pathname: string, search: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  const [base, query] = href.split('?');
  const baseMatch = pathname === base || pathname.startsWith(`${base}/`);
  if (!baseMatch) return false;
  if (!query) return !search || !search.includes('sort=');
  return search.includes(query);
}

/**
 * Sticky top bar — the only global chrome.
 *
 * The old dashboard sidebar is gone: every mainstream tube keeps navigation at
 * the top and gives the full width to thumbnails. Same glass treatment as before,
 * one row taller so the brand has room to breathe.
 */
export function Navbar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  return (
    <header className="nav-surface fixed inset-x-0 top-0 z-50 h-16 border-b border-border">
      <div className="mx-auto flex h-full max-w-[1980px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href={routes.home}
          className="group flex shrink-0 items-center gap-2.5 rounded-control"
          aria-label={`${publicEnv.siteName} — home`}
        >
          <span className="brand-gradient grid size-9 place-items-center rounded-control shadow-glow transition-transform duration-300 ease-spring group-hover:scale-105">
            <Flame className="size-[1.1rem] text-primary-foreground" aria-hidden />
          </span>
          <span className="brand-text hidden font-display text-lg font-bold tracking-[-0.02em] sm:inline">
            {publicEnv.siteName}
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden shrink-0 items-center gap-1 xl:flex">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, search, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-pill px-3.5 py-2 text-[0.8rem] font-semibold transition-colors',
                  active ? 'text-primary' : 'text-foreground-muted hover:text-foreground',
                )}
              >
                {item.label}
                {/* Active marker: a small gold underline that grows in. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-pill brand-gradient transition-transform duration-300 ease-spring',
                    active ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="mx-auto flex w-full max-w-2xl">
          <SearchBox />
        </div>

        <ThemeSwitcher className="hidden shrink-0 sm:flex" />
        <AccountMenu className="shrink-0" />
      </div>
    </header>
  );
}

/**
 * Static stand-in used while the search field (which reads the query string)
 * hydrates. Same height and chrome, so there is no layout shift.
 */
export function NavbarFallback() {
  return (
    <header className="nav-surface fixed inset-x-0 top-0 z-50 h-16 border-b border-border" aria-hidden>
      <div className="mx-auto flex h-full max-w-[1980px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="brand-gradient grid size-9 place-items-center rounded-control shadow-glow">
            <Flame className="size-[1.1rem] text-primary-foreground" />
          </span>
          <span className="brand-text hidden font-display text-lg font-bold tracking-[-0.02em] sm:inline">
            {publicEnv.siteName}
          </span>
        </div>
        <div className="mx-auto w-full max-w-2xl">
          <div className="panel h-11 rounded-pill shadow-soft" />
        </div>
        <div className="size-10 shrink-0" />
        <AccountMenuFallback />
      </div>
    </header>
  );
}
