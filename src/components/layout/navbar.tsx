'use client';

import Link from 'next/link';
import { Flame, PanelLeft } from 'lucide-react';

import { AccountMenu, AccountMenuFallback } from '@/components/layout/account-menu';
import { SearchBox } from '@/components/layout/search-box';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { publicEnv } from '@/lib/env';
import { routes } from '@/lib/routes';

/**
 * Sticky glassmorphic top bar.
 *
 * `nav-surface` supplies the blur and a per-theme background alpha, so the same
 * markup reads as solid in Paper and as frosted glass in Glass.
 */
export function Navbar({ collapsed, onToggleSidebar }: { collapsed?: boolean; onToggleSidebar?: () => void }) {
  return (
    <header className="nav-surface fixed inset-x-0 top-0 z-50 h-14 border-b border-border">
      <div className="flex h-full items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className="hidden size-9 shrink-0 place-items-center rounded-control text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground lg:grid"
          >
            <PanelLeft className="size-[1.1rem]" aria-hidden />
          </button>
        ) : null}

        <Link
          href={routes.home}
          className="flex shrink-0 items-center gap-2 rounded-control"
          aria-label={`${publicEnv.siteName} — home`}
        >
          <span className="brand-gradient grid size-8 place-items-center rounded-control shadow-glow">
            <Flame className="size-4 text-primary-foreground" aria-hidden />
          </span>
          <span className="brand-text hidden font-display text-[1.05rem] font-bold tracking-tight sm:inline">
            {publicEnv.siteName}
          </span>
        </Link>

        <div className="mx-auto flex w-full max-w-2xl">
          <SearchBox />
        </div>

        <ThemeSwitcher className="shrink-0" />
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
    <header className="nav-surface fixed inset-x-0 top-0 z-50 h-14 border-b border-border" aria-hidden>
      <div className="flex h-full items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="hidden size-9 shrink-0 rounded-control bg-surface-raised/70 lg:block" />
        <div className="flex shrink-0 items-center gap-2">
          <span className="brand-gradient grid size-8 place-items-center rounded-control shadow-glow">
            <Flame className="size-4 text-primary-foreground" />
          </span>
          <span className="brand-text hidden font-display text-[1.05rem] font-bold tracking-tight sm:inline">
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
