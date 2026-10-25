import Link from 'next/link';

import { TubeThumbnail } from '@/components/tube/tube-thumbnail';
import { formatCompactNumber, formatRelativeTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { TubeVideo } from '@/lib/tube/models';

export interface TubeCardProps {
  video: TubeVideo;
  priority?: boolean;
  /** Kept for call sites that still opt into the 16:9 shelf crop. */
  uniform?: boolean;
}

/**
 * Grid card for an indexed video.
 *
 * Deliberately dense — this is the wall of the site, and the wall is the product.
 * Everything above the title is poster; the source rides a chip on the image so
 * attribution is permanent without stealing a line of text; below it are exactly
 * two lines of title and one quiet meta row. No badges, no buttons, no borders
 * competing with the artwork.
 */
export function TubeCard({ video, priority }: TubeCardProps) {
  const posted = formatRelativeTime(video.publishedAt ?? video.scrapedAt);
  const views = video.views > 0 ? formatCompactNumber(video.views) : null;
  const hoverSrc = video.embedType === 'video' && video.embedUrl ? video.embedUrl : null;

  return (
    <article className="group/card relative flex min-w-0 flex-col gap-2">
      <TubeThumbnail
        src={video.thumbnailUrl}
        title={video.title}
        durationSeconds={video.durationSeconds}
        hoverSrc={hoverSrc}
        pageUrl={video.pageUrl}
        sourceName={video.sourceName}
        href={routes.tube.watch(video.id)}
        // Native poster shape: the wall honours each source's artwork instead of
        // cropping it — Desi Hub's 3:4 stills lose their subject to a 16:9 frame's
        // centre crop, so the frame is built around the poster, never the reverse.
        uniform={false}
        aspectRatio={video.aspectRatio}
        sizes="(min-width: 1536px) 19vw, (min-width: 1024px) 24vw, (min-width: 640px) 32vw, 48vw"
        priority={priority}
      />

      <div className="min-w-0 space-y-1">
        <h3 className="line-clamp-2 font-display text-[0.82rem] font-medium leading-[1.35] tracking-[-0.005em] text-pretty sm:text-[0.9rem]">
          <Link
            href={routes.tube.watch(video.id)}
            className="transition-colors group-hover/card:text-primary focus-visible:outline-none"
          >
            {video.pinned ? (
              <span aria-label="Pinned" className="mr-1 text-primary">
                ★
              </span>
            ) : null}
            {video.title || 'Untitled'}
          </Link>
        </h3>

        <p className="flex flex-wrap items-center gap-x-1.5 text-[0.7rem] leading-4 text-foreground-subtle">
          {views ? <span className="font-medium text-foreground-muted">{views} views</span> : null}
          {views && posted ? <span aria-hidden>·</span> : null}
          {posted ? <span suppressHydrationWarning>{posted}</span> : null}
        </p>
      </div>
    </article>
  );
}
