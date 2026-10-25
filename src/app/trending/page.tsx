import { Flame, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AdLeadStrip, AdSlot } from '@/components/ads/ad-slot';
import { PageHeader, SectionHeading } from '@/components/layout/page-header';
import { TubeFeed } from '@/components/tube/tube-feed';
import { formatCompactNumber, formatRelativeTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import { listVideos, tubeStats } from '@/lib/tube/db';
import type { TubeVideo } from '@/lib/tube/models';

export const metadata: Metadata = {
  title: 'Trending',
  description: 'The most-watched scenes across every site we index, ranked by our own view counter.',
};

export const dynamic = 'force-dynamic';

const TOP = 12;

/** A single ranked row in the hall of fame. */
function RankedRow({ video, rank }: { video: TubeVideo; rank: number }) {
  return (
    <li>
      <Link
        href={routes.tube.watch(video.id)}
        className="group/rank flex items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-surface-raised sm:gap-4"
      >
        <span className="w-8 shrink-0 text-center font-display text-2xl font-extrabold tabular-nums leading-none text-foreground-subtle/40 transition-colors group-hover/rank:text-primary sm:w-10 sm:text-3xl">
          {String(rank).padStart(2, '0')}
        </span>
        <span
          aria-hidden
          className="w-28 shrink-0 rounded-md bg-surface-sunken bg-cover ring-1 ring-white/[0.06] sm:w-40"
          style={{
            aspectRatio: String(video.aspectRatio || 16 / 9),
            backgroundPosition: 'center top',
            ...(video.thumbnailUrl ? { backgroundImage: `url("${video.thumbnailUrl}")` } : {}),
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 font-display text-[0.85rem] font-medium leading-[1.3] transition-colors group-hover/rank:text-primary sm:text-base">
            {video.title || 'Untitled'}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.68rem] text-foreground-subtle">
            <span className="font-bold uppercase tracking-[0.06em] text-primary/85">{video.sourceName}</span>
            {video.views > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatCompactNumber(video.views)} views</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span suppressHydrationWarning>{formatRelativeTime(video.publishedAt ?? video.scrapedAt)}</span>
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-foreground-subtle sm:inline-flex">
          <Flame className="size-3 text-primary" aria-hidden />
          #{rank}
        </span>
      </Link>
    </li>
  );
}

/**
 * Trending.
 *
 * Ranked rows first — a chart is more persuasive than a grid, and it is the one
 * place a number in front of a thumbnail feels like information. The ranking is
 * live velocity (views per day since release, recomputed on every read) rather
 * than a stored all-time score, so the chart moves as people watch — a scene
 * that caught fire yesterday outranks a blockbuster whose views stopped moving
 * in March. The wall below continues the ranking from #11 so nothing repeats.
 */
export default function TrendingPage() {
  const top = listVideos({ sort: 'trending', page: 1, perPage: TOP });
  const rest = listVideos({ sort: 'trending', page: 2, perPage: TOP });
  const stats = tubeStats();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <TrendingUp className="size-3.5" aria-hidden />
            {formatCompactNumber(stats.publishedVideos)} scenes ranked
          </>
        }
        title="Trending now"
        description="Ranked by views per day since release, recomputed on every read — our counter, not a platform's, and never a static list. No paid promotion, no editorial thumb on the scale."
      />

      <AdLeadStrip />

      {top.items.length > 0 ? (
        <ol className="panel divide-y divide-border/60 rounded-xl px-2 py-2">
          {top.items.map((video, index) => (
            <RankedRow key={video.id} video={video} rank={index + 1} />
          ))}
        </ol>
      ) : null}

      <AdSlot placement="feed-billboard" />

      <section aria-labelledby="more-heading" className="space-y-4">
        <SectionHeading
          title={<span id="more-heading">#11 and beyond</span>}
          description="The rest of the chart, still in view order."
        />
        {rest.items.length > 0 ? (
          <TubeFeed initial={rest} query={{ sort: 'trending', perPage: TOP }} />
        ) : (
          <p className="text-sm text-foreground-subtle">
            That is the whole chart.{' '}
            <Link href={routes.tube.index} className="text-primary hover:underline">
              Browse all videos
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
