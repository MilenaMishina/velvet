import { MessageSquare, Pin, Play } from 'lucide-react';
import Link from 'next/link';

import { TubeThumbnail } from '@/components/tube/tube-thumbnail';
import { formatCompactNumber, formatRelativeTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { TubeVideo } from '@/lib/tube/models';

export interface TubeCardProps {
  video: TubeVideo;
  priority?: boolean;
  /** Crop the frame to 16:9 for the horizontal shelves. */
  uniform?: boolean;
}

/**
 * Grid card for an indexed video.
 *
 * The whole card is one link to our play page, overlaid affordances only: the
 * duration sits where every tube puts it, the source chip keeps attribution
 * permanently visible, and an external-link button fades in on hover for the
 * original page. Below the frame: a two-line clamped title and one quiet meta
 * row — no badge clutter anywhere.
 */
export function TubeCard({ video, priority, uniform }: TubeCardProps) {
  const posted = formatRelativeTime(video.publishedAt ?? video.scrapedAt);
  const views = video.views > 0 ? formatCompactNumber(video.views) : null;
  const hoverSrc = video.embedType === 'video' && video.embedUrl ? video.embedUrl : null;

  return (
    <article className="group/card relative flex flex-col gap-2.5">
      <Link href={routes.tube.watch(video.id)} className="block rounded-card focus-visible:outline-none">
        <TubeThumbnail
          src={video.thumbnailUrl}
          title={video.title}
          durationSeconds={video.durationSeconds}
          hoverSrc={hoverSrc}
          pageUrl={video.pageUrl}
          sourceName={video.sourceName}
          aspectRatio={video.aspectRatio}
          uniform={uniform}
          sizes="(min-width: 1536px) 22vw, (min-width: 1280px) 28vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
          priority={priority}
        />
      </Link>

      <div className="min-w-0 space-y-1">
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug tracking-[-0.01em] text-pretty">
          <Link
            href={routes.tube.watch(video.id)}
            className="transition-colors group-hover/card:text-primary focus-visible:outline-none"
          >
            {video.pinned ? (
              <Pin className="mb-0.5 mr-1 inline size-3 text-primary" aria-label="Pinned" />
            ) : null}
            {video.title || 'Untitled'}
          </Link>
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-foreground-muted">
          {views ? (
            <span className="inline-flex items-center gap-1">
              <Play className="size-3 text-foreground-subtle" aria-hidden />
              {views}
            </span>
          ) : null}
          {posted ? (
            <>
              {views ? <span aria-hidden className="text-foreground-subtle">•</span> : null}
              {/* `suppressHydrationWarning` — this string is computed from the clock on
                  both sides, so if the SSR and hydration moments straddle a boundary
                  ("last week" → "2 months ago") we keep the server's text instead of
                  forcing a full client re-render of the boundary. */}
              <span suppressHydrationWarning>{posted}</span>
            </>
          ) : null}
          {video.commentCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="text-foreground-subtle">•</span>
              <MessageSquare className="size-3 text-foreground-subtle" aria-hidden />
              {formatCompactNumber(video.commentCount)}
            </span>
          ) : null}
          <Link
            href={routes.tube.filtered({ source: video.sourceId })}
            className="font-medium text-foreground-subtle transition-colors hover:text-primary"
          >
            • {video.sourceName}
          </Link>
        </div>
      </div>
    </article>
  );
}
