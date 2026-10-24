import { Flame, Pin, Sparkles, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AdLeadStrip, AdSlot } from '@/components/ads/ad-slot';
import { AdNative } from '@/components/ads/ad-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { SectionHeading } from '@/components/layout/page-header';
import { TubeCard } from '@/components/tube/tube-card';
import { TubeFeed } from '@/components/tube/tube-feed';
import { formatCompactNumber } from '@/lib/format';
import { publicEnv } from '@/lib/env';
import { routes } from '@/lib/routes';
import { listPinnedVideos, listSourcesWithCounts, listVideos, tubeStats } from '@/lib/tube/db';
import { HOME_PIN_LIMIT } from '@/lib/tube/models';
import { cn } from '@/lib/utils';

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
const TRENDING_LIMIT = 8;

/**
 * Home.
 *
 * No hero, no explainer card — nothing between a visitor and the thumbnails.
 * The page reads like a premium tube: a sticky filter rail, two editorial shelves
 * (pinned and trending, horizontal snap rails), then the newest-first feed that
 * never runs out. The first page is read straight from SQLite on the server, so
 * the content is real before any JavaScript runs.
 */
export default function HomePage() {
  const pinned = listPinnedVideos(HOME_PIN_LIMIT);
  const trending = listVideos({ sort: 'views', page: 1, perPage: TRENDING_LIMIT }).items;
  const result = listVideos({ sort: 'newest', page: 1, perPage: PAGE_SIZE, excludePinned: true });
  const stats = tubeStats();
  const sources = listSourcesWithCounts().filter((source) => source.count > 0);

  return (
    <div className="space-y-9">
      {/* ── Filter rail: sources, stickily under the nav. ────────────────────── */}
      <nav
        aria-label="Sites we index"
        className="nav-surface sticky top-16 z-30 -mx-4 overflow-x-auto px-4 py-3 no-scrollbar sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <ul className="flex w-max items-center gap-2">
          <li>
            <Link href={routes.tube.index} className="chip chip-active">
              <Sparkles className="size-3" aria-hidden />
              All sites
            </Link>
          </li>
          {sources.map((source) => (
            <li key={source.id}>
              <Link href={routes.tube.filtered({ source: source.id })} className="chip">
                {source.name}
                <span className="tabular-nums text-2xs opacity-60">{source.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <AdLeadStrip />

      {/* ── Featured shelf: the operator's pins, in a horizontal snap rail. ──── */}
      {pinned.length > 0 ? (
        <section aria-labelledby="pinned-heading" className="space-y-4">
          <SectionHeading
            className="px-0.5"
            title={
              <span id="pinned-heading" className="inline-flex items-center gap-2">
                <Pin className="size-4 text-primary" aria-hidden />
                Featured
              </span>
            }
            description="Hand-picked by the editors."
          />
          <div className="rail">
            {pinned.map((video) => (
              <TubeCard key={video.id} video={video} uniform />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Trending shelf: what everyone else is watching right now. ────────── */}
      {trending.length > 0 ? (
        <section aria-labelledby="trending-heading" className="space-y-4">
          <SectionHeading
            className="px-0.5"
            title={
              <span id="trending-heading" className="inline-flex items-center gap-2">
                <TrendingUp className="size-4 text-accent" aria-hidden />
                Trending now
              </span>
            }
            description="The most-watched videos across every indexed site."
            actions={
              <Link
                href={routes.trending}
                className="text-xs font-semibold text-foreground-muted transition-colors hover:text-primary"
              >
                View all
              </Link>
            }
          />
          <div className="rail">
            {trending.map((video) => (
              <TubeCard key={video.id} video={video} uniform />
            ))}
          </div>
        </section>
      ) : null}

      {/* The widest unit the network issues for the home page, given a full-width
          row of its own between the shelves and the feed. */}
      <AdSlot placement="home-super" />

      {/* ── The feed: everything new, endless. ───────────────────────────────── */}
      <section aria-labelledby="latest-heading" className="space-y-5">
        <SectionHeading
          className="px-0.5"
          title={
            <span id="latest-heading" className="inline-flex items-center gap-2">
              <Flame className="size-4 text-primary" aria-hidden />
              Latest updates
            </span>
          }
          description={
            stats.publishedVideos > 0
              ? `${formatCompactNumber(stats.publishedVideos)} videos from ${sources.length || 'our'} ${
                  sources.length === 1 ? 'site' : 'sites'
                }, newest first.`
              : undefined
          }
          actions={
            <Link
              href={routes.tube.index}
              className="text-xs font-semibold text-foreground-muted transition-colors hover:text-primary"
            >
              Browse everything
            </Link>
          }
        />

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
      </section>

      {/* Sponsor row: the three units whose shape is wrong for a card grid. */}
      <section aria-label="Sponsors" className={cn('panel rounded-card p-4')}>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <AdSlot placement="home-square" />
          <AdSlot placement="home-strip" />
          <AdSlot placement="poster-square" />
        </div>
      </section>
    </div>
  );
}
