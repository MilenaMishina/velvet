'use client';

import { AdPartnerBand } from '@/components/ads/ad-smartlink';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Navbar } from '@/components/layout/navbar';
import { SiteNotice } from '@/components/layout/site-chrome';
import { VisitBeacon } from '@/components/layout/visit-beacon';

/**
 * Application chrome: fixed nav, content column, global footer, mobile bottom bar.
 *
 * A client component because the nav tracks the active path and hosts the search
 * field. It is deliberately not wrapped in Suspense: the chrome renders the same
 * markup on the server and the client, so hydration is a straight swap.
 *
 * `footer` is a server component handed down from the root layout — the database
 * reads it needs (live tag counts) stay on the server while the shell stays client.
 */
export function AppShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Bottom padding leaves room for the mobile nav bar. */}
      <main id="main" className="pb-[5.5rem] pt-16 lg:pb-6">
        <div className="mx-auto max-w-[1980px] px-4 py-6 sm:px-6 lg:px-8">
          <SiteNotice />
          {children}
          {/* The small wide units have no natural home in a grid, so they close every
              page together, labelled, rather than being hidden in the feed. */}
          <AdPartnerBand className="mt-10" />
        </div>
      </main>

      {footer}
      <MobileNav />
      <VisitBeacon />
    </div>
  );
}
