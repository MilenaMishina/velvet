import { ArrowUpRight, Flame, Pin, Sparkles, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AdLeadStrip, AdSlot } from '@/components/ads/ad-slot';
import { AdNative } from '@/components/ads/ad-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { SectionHeading } from '@/components/layout/page-header';
import { RecentlyViewed } from '@/components/tube/recently-viewed';
import { TubeFeed } from '@/components/tube/tube-feed';
import { TubeGrid } from '@/components/tube/tube-grid';
import { TubeThumbnail } from '@/components/tube/tube-thumbnail';
import { formatCompactNumber, formatRelativeTime } from '@/lib/format';
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

const PAGE_SIZE = 18;
const TRENDING_LIMIT = 8;

/**
 * Home.
 *
 * A cinematic hero (the top pin, full-bleed, title over the poster) beside a
 * ranked "most watched" column, then two dense shelves and the endless wall.
 * Nothing explains the site — the artwork does that. Every block is content.
 */
export default function HomePage() {
  const pinned = listPinnedVideos(HOME_PIN_LIMIT);
  // The shelf is live velocity — views per day since release, computed on every
  // read — so what is "hot" moves as soon as anyone watches anything. A static
  // all-time rank would keep the same three videos pinned to the front page for
  // weeks, which is the opposite of a trending shelf.
  const trending = listVideos({ sort: 'trending', page: 1, perPage: TRENDING_LIMIT }).items;
  const result = listVideos({ sort: 'newest', page: 1, perPage: PAGE_SIZE, excludePinned: true });
  const stats = tubeStats();
  const sources = listSourcesWithCounts().filter((source) => source.count > 0);

  const hero = pinned[0] ?? trending[0] ?? null;
  const ranked = trending.filter((video) => video.id !== hero?.id).slice(0, 4);
  const trendingShelf = trending.slice(0, 10);

  return (
    <div className="space-y-10">
      {/* ── Filter rail: sources, stickily under the nav. ────────────────────── */}
      <nav
        aria-label="Sites we index"
        className="nav-surface sticky top-16 z-30 -mx-4 overflow-x-auto px-4 py-2.5 no-scrollbar sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <ul className="flex w-max items-center gap-2">
          <li>
            <Link href={routes.tube.index} className="chip chip-active !py-1.5">
              <Sparkles className="size-3" aria-hidden />
              All sites
            </Link>
          </li>
          {sources.map((source) => (
            <li key={source.id}>
              <Link href={routes.tube.filtered({ source: source.id })} className="chip !py-1.5">
                {source.name}
                <span className="tabular-nums text-2xs opacity-60">{formatCompactNumber(source.count)}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/random" prefetch={false} className="chip !py-1.5 !text-primary">
              🎲 Surprise me
            </Link>
          </li>
        </ul>
      </nav>

      {/* ── Hero band: the cover story + what everyone is watching. ──────────── */}
      {hero ? (
        <section aria-labelledby="featured-heading" className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <h2 id="featured-heading" className="sr-only">
            Featured
          </h2>

          <Link
            href={routes.tube.watch(hero.id)}
            className="group/card relative block overflow-hidden rounded-xl focus-visible:outline-none"
          >
            <TubeThumbnail
              src={hero.thumbnailUrl}
              title={hero.title}
              durationSeconds={hero.durationSeconds}
              hoverSrc={hero.embedType === 'video' && hero.embedUrl ? hero.embedUrl : null}
              sourceName={hero.sourceName}
              uniform
              feature
              priority
              sizes="(min-width: 1024px) 62vw, 100vw"
            />
            {/* Title plate over the poster's lower half. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/60 to-transparent p-4 pt-16 sm:p-6 sm:pt-24">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-primary-foreground shadow-glow">
                <Pin className="size-3" aria-hidden />
                Featured
              </span>
              <h3 className="mt-2.5 max-w-2xl font-display text-lg font-extrabold uppercase leading-[1.12] tracking-[-0.01em] text-white sm:text-2xl lg:text-3xl">
                {hero.title || 'Untitled'}
              </h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white/65">
                <span className="text-white/90">{hero.sourceName}</span>
                <span aria-hidden>·</span>
                <span suppressHydrationWarning>{formatRelativeTime(hero.publishedAt ?? hero.scrapedAt)}</span>
                {hero.views > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{formatCompactNumber(hero.views)} views</span>
                  </>
                ) : null}
              </p>
            </div>
          </Link>

          {/* Ranked most-watched column — editorial, not another grid. */}
          <div className="panel flex flex-col rounded-xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2 pb-2">
              <h3 className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-[0.14em] text-foreground-muted">
                <TrendingUp className="size-3.5 text-accent" aria-hidden />
                Most watched
              </h3>
              <Link
                href={routes.trending}
                className="inline-flex items-center gap-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-foreground-subtle transition-colors hover:text-primary"
              >
                Top 50
                <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            </div>
            <ol className="flex flex-1 flex-col justify-between gap-1">
              {ranked.map((video, index) => (
                <li key={video.id}>
                  <Link
                    href={routes.tube.watch(video.id)}
                    className="group/rank flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-raised"
                  >
                    <span className="w-5 shrink-0 text-center font-display text-base font-extrabold tabular-nums text-foreground-subtle/50 transition-colors group-hover/rank:text-primary">
                      {index + 1}
                    </span>
                    <span
                      aria-hidden
                      className="aspect-video w-16 shrink-0 rounded-md bg-surface-sunken bg-cover bg-center ring-1 ring-white/[0.06]"
                      style={video.thumbnailUrl ? { backgroundImage: `url("${video.thumbnailUrl}")` } : undefined}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[0.78rem] font-medium leading-[1.3] transition-colors group-hover/rank:text-primary">
                        {video.title}
                      </span>
                      <span className="mt-0.5 block text-[0.62rem] font-bold uppercase tracking-[0.06em] text-foreground-subtle">
                        {video.views > 0 ? `${formatCompactNumber(video.views)} views` : video.sourceName}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <Link
              href={routes.random}
              prefetch={false}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border/80 py-2.5 text-[0.66rem] font-extrabold uppercase tracking-[0.1em] text-foreground-muted transition-colors hover:border-primary/50 hover:text-primary"
            >
              🎲 Take me somewhere random
            </Link>
          </div>
        </section>
      ) : null}

      <AdLeadStrip />

      {/* ── Trending shelf. ──────────────────────────────────────────────────── */}
      {trendingShelf.length > 0 ? (
        <section aria-labelledby="trending-heading" className="space-y-3.5">
          <SectionHeading
            title={
              <span id="trending-heading" className="inline-flex items-center gap-2">
                <Flame className="size-4 text-primary" aria-hidden />
                Trending now
              </span>
            }
            description="What everyone is watching across every indexed site."
            actions={
              <Link
                href={routes.trending}
                className="inline-flex items-center gap-0.5 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-foreground-subtle transition-colors hover:text-primary"
              >
                View all
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <TubeGrid videos={trendingShelf} layout="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5" />
        </section>
      ) : null}

      <RecentlyViewed />

      <AdSlot placement="home-super" />

      {/* ── The wall: everything new, endless. ───────────────────────────────── */}
      <section aria-labelledby="latest-heading" className="space-y-4">
        <SectionHeading
          title={
            <span id="latest-heading" className="inline-flex items-center gap-2">
              <Flame className="size-4 text-accent" aria-hidden />
              Fresh uploads
            </span>
          }
          description={
            stats.publishedVideos > 0
              ? `${formatCompactNumber(stats.publishedVideos)} scenes from ${sources.length || 'our'} ${
                  sources.length === 1 ? 'site' : 'sites'
                }, newest first.`
              : undefined
          }
          actions={
            <Link
              href={routes.tube.index}
              className="inline-flex items-center gap-0.5 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-foreground-subtle transition-colors hover:text-primary"
            >
              Browse everything
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          }
        />

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

      <AdSlot placement="home-strip" caption="Advertisement" />
    </div>
  );
}
