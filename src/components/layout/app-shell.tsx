'use client';

import { Suspense } from 'react';

import { Navbar, NavbarFallback } from '@/components/layout/navbar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Sidebar, SidebarFallback } from '@/components/layout/sidebar';
import { SiteNotice } from '@/components/layout/site-chrome';
import { VisitBeacon } from '@/components/layout/visit-beacon';
import { SIDEBAR_WIDTH, useSidebar } from '@/components/providers/sidebar-provider';

/**
 * Application chrome: fixed nav, desktop sidebar, mobile bottom bar.
 *
 * A client component because the sidebar width is a visitor preference. The width
 * travels as a single CSS variable on the wrapper — `--sidebar-w` — so the rail and
 * the content offset are driven by the same number and can never disagree.
 *
 * The nav and sidebar read the query string (active tab, live search term), which
 * opts their subtree into client rendering. Keeping each in its own Suspense
 * boundary means a filter change doesn't re-render the page below them.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebar();
  const width = collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded;

  return (
    <div className="min-h-screen" style={{ '--sidebar-w': `${width}rem` } as React.CSSProperties}>
      <Suspense fallback={<NavbarFallback />}>
        <Navbar collapsed={collapsed} onToggleSidebar={toggle} />
      </Suspense>

      <aside
        aria-label="Browse"
        className="fixed inset-y-0 left-0 z-40 hidden border-r border-border pt-14 transition-[width] duration-300 ease-spring lg:block"
        style={{ width: 'var(--sidebar-w)' }}
      >
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar collapsed={collapsed} />
        </Suspense>
      </aside>

      {/* Bottom padding leaves room for the mobile nav bar. */}
      <main id="main" className="pb-[5.5rem] pt-14 lg:pb-10 lg:pl-[var(--sidebar-w)]">
        <div className="mx-auto max-w-[1980px] px-4 py-6 sm:px-6 lg:px-8">
          <SiteNotice />
          {children}
        </div>
      </main>

      <MobileNav />
      <VisitBeacon />
    </div>
  );
}
