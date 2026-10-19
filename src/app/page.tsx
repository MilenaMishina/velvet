import { Flame, Pin, Sparkles, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AdLeadStrip, AdSlot } from '@/components/ads/ad-slot';
import { AdNative } from '@/components/ads/ad-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { TubeFeed } from '@/components/tube/tube-feed';
import { TubeGrid } from '@/components/tube/tube-grid';
import { Button } from '@/components/ui/button';
import { formatCompactNumber } from '@/lib/format';
import { publicEnv } from '@/lib/env';
import { routes } from '@/lib/routes';
import { listPinnedVideos, listSourcesWithCounts, listVideos, tubeStats } from '@/lib/tube/db';
import { HOME_PIN_LIMIT } from '@/lib/tube/models';

export const metadata: Metadata = {
  title: 'Browse',
  description:
    'Thousands of adult videos from the sites we index, newest first, played from each publisher’s own player.',
};

/**
 * The catalogue is local database state that changes on every sync, so this page
 * must never be prerendered — that would also create the SQLite file at build time.
 */
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

/**
 * Home.
 *
 * A brand band over the newest videos we hold, then an infinite feed. No third-party
 * API sits in the path: the first page is read straight from SQLite on the server, so
 * the page has real content before any JavaScript runs, and "load more" pages come
 * from our own `/api/tube/videos`.
 */
export default function HomePage() {
  // Pinned rows lead the page and are removed from the feed beneath it, so the same
  // card never appears twice on one screen.
  const pinned = listPinnedVideos(HOME_PIN_LIMIT);
  const result = listVideos({ sort: 'newest', page: 1, perPage: PAGE_SIZE, excludePinned: true });
  const stats = tubeStats();
  const sources = listSourcesWithCounts().filter((source) => source.count > 0);

  return (
    <div className="space-y-8">
      <section className="relative isolate">
        {/* The hero frame: a hairline gold ring and a deep lift make the panel read as
            a slab of polished stone rather than a card — the single biggest lever in
            the page's first impression. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-card shadow-glow ring-1 ring-border"
        />
        <div className="panel relative isolate overflow-hidden rounded-card px-6 py-12 shadow-card sm:px-12 sm:py-20">
          {/* Decorative aurora concentrated behind the headline, plus a slow sheen that
              sweeps the panel once — motion that reads as light on stone. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-80"
            style={{
              backgroundImage:
                'radial-gradient(44rem 22rem at 10% 0%, hsl(var(--primary) / 0.2), transparent 62%), radial-gradient(34rem 20rem at 94% 8%, hsl(var(--accent) / 0.16), transparent 60%), radial-gradient(30rem 22rem at 55% 110%, hsl(var(--primary) / 0.1), transparent 65%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 animate-shimmer bg-sheen"
          />

          <div className="max-w-3xl space-y-6">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="size-3.5" aria-hidden />
              <span>
                {formatCompactNumber(stats.publishedVideos)} videos indexed from {sources.length || 'our'}{' '}
                {sources.length === 1 ? 'site' : 'sites'}
              </span>
            </p>

            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-pretty sm:text-6xl">
              Adult video, <span className="brand-text">finally organised</span>.
            </h1>

            {/* A short gold flourish under the headline: the one hard accent in an
                otherwise quiet hero, so the eye lands on the brand before the grid. */}
            <div aria-hidden className="hairline h-px w-24" style={{ backgroundImage: 'linear-gradient(to right, hsl(var(--primary)), transparent)' }} />

            <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted sm:text-base">
              We index the scenes and frame each publisher&rsquo;s own player, so playback always credits the site that
              made it. Newest first, straight from the sources we follow — nothing copied, cached or re-hosted.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button asChild size="lg" pill>
                <Link href={routes.tube.index}>
                  <Flame aria-hidden />
                  Browse everything
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" pill>
                <Link href={routes.trending}>
                  <TrendingUp aria-hidden />
                  Most watched
                </Link>
              </Button>
            </div>

            {sources.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-2 pt-3">
                {sources.map((source) => (
                  <li key={source.id}>
                    <Link
                      href={routes.tube.filtered({ source: source.id })}
                      className="panel inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground"
                    >
                      {source.name}
                      <span className="tabular-nums text-foreground-subtle">{source.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      <AdLeadStrip />

      {/* The widest unit the network issues for the home page, given a full-width
          row of its own. */}
      <AdSlot placement="home-super" />

      {pinned.length > 0 ? (
        <section aria-labelledby="pinned-heading" className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pin className="size-4 text-primary" aria-hidden />
            <h2 id="pinned-heading" className="font-display text-lg font-semibold tracking-[-0.01em]">
              Pinned
            </h2>
            <span className="text-xs text-foreground-subtle">Hand-picked and kept up top.</span>
          </div>
          <TubeGrid videos={pinned} />
        </section>
      ) : null}

      {/* Sponsor row: the three units whose shape is wrong for a card grid. */}
      <section aria-label="Sponsors" className="panel rounded-card p-4">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <AdSlot placement="home-square" />
          <AdSlot placement="home-strip" />
          <AdSlot placement="poster-square" />
        </div>
      </section>

      <AdSlot placement="feed-rectangle" />

      <AdNative />

      <TubeFeed
        initial={result}
        query={{ sort: 'newest', perPage: PAGE_SIZE, excludePinned: true }}
        emptyState={
          <EmptyState
            icon={Flame}
            title={`${publicEnv.siteName} has nothing indexed yet`}
            description="The catalogue is built by the source sync, and the database only exists once it has run. Trigger a sync, then reload."
            action={
              <code className="block w-full max-w-md overflow-x-auto rounded-control bg-surface-raised px-3 py-2 text-left text-xs text-foreground">
                curl &quot;/api/cron/sync?secret=$CRON_SECRET&amp;pages=60&amp;maxFetches=900&quot;
              </code>
            }
          />
        }
      />
    </div>
  );
}
