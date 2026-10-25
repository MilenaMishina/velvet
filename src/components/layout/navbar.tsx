'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dices, Flame } from 'lucide-react';

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

/**
 * Exact match for `/`; prefix match for section routes.
 *
 * Trending has its own route now, so nothing here needs the query string — which
 * is what lets the navbar hydrate deterministically (see the component note).
 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sticky top bar — the only global chrome.
 *
 * Deliberately free of `useSearchParams`: reading it here used to suspend the
 * whole header during hydration, so the server's fallback markup and the real
 * chrome disagreed and React tore down/rebuilt the entire nav on every load.
 * The active tab is a pure function of the path now.
 */
export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="nav-surface fixed inset-x-0 top-0 z-50 h-16">
      {/* The house gradient as a 2px edge under the bar — the site's signature hairline. */}
      <div aria-hidden className="heat-gradient absolute inset-x-0 bottom-0 h-0.5 opacity-80" />
      <div className="mx-auto flex h-full max-w-[1980px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href={routes.home}
          className="group flex shrink-0 items-center gap-2.5 rounded-control"
          aria-label={`${publicEnv.siteName} — home`}
        >
          <span className="heat-gradient grid size-9 place-items-center rounded-control shadow-glow transition-transform duration-300 ease-spring group-hover:scale-105 group-hover:rotate-3">
            <Flame className="size-[1.15rem] text-primary-foreground" aria-hidden />
          </span>
          <span className="hidden text-xl font-extrabold tracking-[-0.03em] sm:inline">
            <span className="text-foreground">{publicEnv.siteName}</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden shrink-0 items-center gap-0.5 lg:flex">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-pill px-2 py-2 text-[0.68rem] font-bold uppercase tracking-[0.06em] transition-colors xl:px-3 xl:text-[0.76rem] xl:tracking-[0.08em]',
                  active ? 'text-foreground' : 'text-foreground-muted hover:text-foreground',
                )}
              >
                {item.label}
                {/* Active marker: the house gradient underline that grows in. */}
                <span
                  aria-hidden
                  className={cn(
                    'heat-gradient absolute inset-x-3 -bottom-0.5 h-0.5 rounded-pill transition-transform duration-300 ease-spring',
                    active ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="mx-auto flex min-w-0 max-w-md flex-1 justify-center xl:max-w-2xl">
          <SearchBox className="min-w-0" />
        </div>

        <Link
          href={routes.random}
          prefetch={false}
          aria-label="Surprise me — open a random scene"
          title="Surprise me"
          className="hidden size-10 shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-surface-raised hover:text-primary sm:grid"
        >
          <Dices className="size-[1.15rem]" aria-hidden />
        </Link>
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
    <header className="nav-surface fixed inset-x-0 top-0 z-50 h-16" aria-hidden>
      <div aria-hidden className="heat-gradient absolute inset-x-0 bottom-0 h-0.5 opacity-80" />
      <div className="mx-auto flex h-full max-w-[1980px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="heat-gradient grid size-9 place-items-center rounded-control shadow-glow">
            <Flame className="size-[1.15rem] text-primary-foreground" />
          </span>
          <span className="hidden text-xl font-extrabold tracking-[-0.03em] sm:inline">
            <span className="text-foreground">{publicEnv.siteName}</span>
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
