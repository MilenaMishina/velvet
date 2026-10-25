import Link from 'next/link';

import { TubeCard } from '@/components/tube/tube-card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCompactNumber, formatDuration, formatRelativeTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { TubeVideo } from '@/lib/tube/models';
import { cn } from '@/lib/utils';

/**
 * The wall.
 *
 * Rows, not columns: cards share column widths so a row of five reads as one scan
 * line. Frame heights follow each source's native poster shape (a Desi Hub 3:4
 * still plays full-length, an AZNude 16:9 frame stays 16:9) — a centre crop that
 * beheads a portrait poster is worse than a slightly ragged row bottom.
 */
const GRID_LAYOUT = 'grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6';

export interface TubeGridProps {
  videos: TubeVideo[];
  className?: string;
  /** Replaces the default column layout — used by narrow surfaces. */
  layout?: string;
}

/** Uniform row-aligned grid of indexed videos. */
export function TubeGrid({ videos, className, layout }: TubeGridProps) {
  return (
    <div className={cn(layout ?? GRID_LAYOUT, className)}>
      {videos.map((video, index) => (
        <TubeCard key={video.id} video={video} priority={index < 5} />
      ))}
    </div>
  );
}

/**
 * Compact horizontal row — the "more like this" unit.
 *
 * A thumb at 38% width against a two-line title is the densest way to show ten
 * recommendations without turning the rail into a column of billboards. The thumb
 * keeps the poster's native shape — cropping a 3:4 still to 16:9 here would show
 * exactly the neck-down half of every related video.
 */
export function TubeRow({ video }: { video: TubeVideo }) {
  const posted = formatRelativeTime(video.publishedAt ?? video.scrapedAt);
  const duration = formatDuration(video.durationSeconds);
  const views = video.views > 0 ? formatCompactNumber(video.views) : null;

  return (
    <article className="group/row flex gap-2.5">
      <Link
        href={routes.tube.watch(video.id)}
        aria-label={video.title}
        style={{ aspectRatio: String(video.aspectRatio || 16 / 9) }}
        className="relative w-[8.5rem] shrink-0 overflow-hidden rounded-md bg-surface-sunken ring-1 ring-white/[0.06] sm:w-[9.5rem]"
      >
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote posters are unoptimized by design
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 ease-out-quint group-hover/row:scale-105"
          />
        ) : null}
        {duration ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 py-0.5 text-[0.62rem] font-bold tabular-nums leading-3 text-white">
            {duration}
          </span>
        ) : null}
      </Link>
      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="line-clamp-2 text-[0.8rem] font-medium leading-[1.35] tracking-[-0.005em]">
          <Link href={routes.tube.watch(video.id)} className="transition-colors group-hover/row:text-primary">
            {video.title || 'Untitled'}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[0.68rem] text-foreground-subtle">
          <span className="font-bold uppercase tracking-[0.06em] text-primary/80">{video.sourceName}</span>
          {views ? (
            <>
              <span aria-hidden>·</span>
              <span>{views}</span>
            </>
          ) : null}
          {posted ? (
            <>
              <span aria-hidden>·</span>
              <span suppressHydrationWarning>{posted}</span>
            </>
          ) : null}
        </p>
      </div>
    </article>
  );
}

/** Card-shaped placeholders so appending a page never shifts the layout. */
export function TubeGridSkeleton({ count = 10, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn(GRID_LAYOUT, className)}>
      <span className="sr-only">Loading more videos…</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          {/* 3/4 — the portrait shape most of the catalogue uses. */}
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
          <Skeleton className="h-3 w-[92%]" />
          <Skeleton className="h-2.5 w-[55%]" />
        </div>
      ))}
    </div>
  );
}
