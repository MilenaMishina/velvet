import { ExternalLink, MessageSquare, Pin, Play } from 'lucide-react';
import Link from 'next/link';

import { TubeThumbnail } from '@/components/tube/tube-thumbnail';
import { Badge } from '@/components/ui/badge';
import { formatCompactNumber, formatRelativeTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { TubeVideo } from '@/lib/tube/models';
import { cn } from '@/lib/utils';

export interface TubeCardProps {
  video: TubeVideo;
  priority?: boolean;
}

/** `https://www.aznude.com/x` → `aznude.com`, used for the attribution chip. */
function hostLabel(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

/**
 * Grid card for an indexed video.
 *
 * The card links to our own play page, but the source host is always visible and
 * the card also exposes the original page directly — the creators'/publishers'
 * attribution is never hidden behind our own UI.
 */
export function TubeCard({ video, priority }: TubeCardProps) {
  const posted = formatRelativeTime(video.publishedAt ?? video.scrapedAt);
  const views = video.views > 0 ? `${formatCompactNumber(video.views)} views` : 'Not yet viewed';

  return (
    <article className={cn('group/card relative flex flex-col gap-3')}>
      <Link href={routes.tube.watch(video.id)} className="block rounded-card focus-visible:outline-none">
        <TubeThumbnail
          src={video.thumbnailUrl}
          title={video.title}
          durationSeconds={video.durationSeconds}
          embedType={video.embedType}
          aspectRatio={video.aspectRatio}
          sizes="(min-width: 1536px) 22vw, (min-width: 1280px) 28vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
          priority={priority}
        />
      </Link>

      <div className="min-w-0 space-y-1.5">
        <h3 className="font-display text-sm font-semibold leading-snug tracking-[-0.01em] text-pretty">
          <Link
            href={routes.tube.watch(video.id)}
            className="transition-colors hover:text-primary focus-visible:outline-none"
          >
            {video.title || 'Untitled'}
          </Link>
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted">
          {video.pinned ? (
            <Badge tone="accent">
              <Pin className="size-2.5" aria-hidden />
              Pinned
            </Badge>
          ) : null}
          <Link
            href={routes.tube.filtered({ source: video.sourceId })}
            className="font-medium text-foreground-muted transition-colors hover:text-foreground"
          >
            {video.sourceName}
          </Link>
          {posted ? <span aria-hidden>•</span> : null}
          {posted ? <span>{posted}</span> : null}
          <span aria-hidden>•</span>
          <span>{views}</span>
          {video.commentCount > 0 ? (
            <>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3" aria-hidden />
                {formatCompactNumber(video.commentCount)}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Badge tone="neutral">
            <Play className="size-2.5" aria-hidden />
            {hostLabel(video.pageUrl)}
          </Badge>
          <a
            href={video.pageUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-foreground-subtle transition-colors hover:text-foreground"
          >
            Original
            <ExternalLink className="size-2.5" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}
