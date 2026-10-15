'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import * as React from 'react';

import { ChannelAvatar } from '@/components/video/channel-avatar';
import { CardLibraryActions } from '@/components/video/library-toggle';
import { VideoThumbnail } from '@/components/video/video-thumbnail';
import { usePrefersReducedMotion, useMediaQuery } from '@/lib/hooks/use-media-query';
import { formatAbsoluteDate, formatCompactNumber, formatRelativeTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppVideo } from '@/lib/youtube/models';

export type VideoCardVariant = 'default' | 'featured' | 'compact';

export interface VideoCardProps {
  video: AppVideo;
  variant?: VideoCardVariant;
  /** Staggered entrance index. Capped internally so late cards aren't delayed. */
  index?: number;
  priority?: boolean;
  className?: string;
  showChannel?: boolean;
}

const SIZES: Record<VideoCardVariant, string> = {
  default: '(min-width: 1536px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw',
  featured: '(min-width: 1024px) 60vw, 92vw',
  compact: '(min-width: 640px) 22rem, 45vw',
};

/** How long a pointer must rest on a card before we spend an iframe on a preview. */
const HOVER_INTENT_MS = 620;

export function VideoCard({
  video,
  variant = 'default',
  index = 0,
  priority = false,
  className,
  showChannel = true,
}: VideoCardProps) {
  const [previewing, setPreviewing] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  const reducedMotion = usePrefersReducedMotion();
  // Touch devices have no hover state, and autoplaying there would be hostile.
  const canHoverPreview = useMediaQuery('(hover: hover) and (pointer: fine)') && !reducedMotion;

  const clearTimer = React.useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onEnter = React.useCallback(() => {
    if (!canHoverPreview) return;
    clearTimer();
    timer.current = window.setTimeout(() => setPreviewing(true), HOVER_INTENT_MS);
  }, [canHoverPreview, clearTimer]);

  const onLeave = React.useCallback(() => {
    clearTimer();
    setPreviewing(false);
  }, [clearTimer]);

  React.useEffect(() => clearTimer, [clearTimer]);

  const views = video.viewCount === null ? null : `${formatCompactNumber(video.viewCount)} views`;
  const published = formatRelativeTime(video.publishedAt);
  const watchHref = routes.watch(video.id);
  const isCompact = variant === 'compact';
  const isFeatured = variant === 'featured';

  return (
    <motion.article
      className={cn(
        'group relative animate-fade-up',
        isCompact ? 'flex gap-3' : 'flex flex-col',
        className,
      )}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      initial={false}
      whileHover={reducedMotion || isCompact ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
      // Entrance is CSS-driven so cards stay visible if JS never runs.
      data-variant={variant}
    >
      <Link
        href={watchHref}
        aria-label={`Watch ${video.title} from ${video.channel.title}`}
        className={cn(
          'relative block overflow-hidden rounded-card focus-visible:ring-offset-0',
          isCompact ? 'w-40 shrink-0 sm:w-44' : 'w-full',
        )}
      >
        <VideoThumbnail
          video={video}
          previewing={previewing}
          sizes={SIZES[variant]}
          priority={priority}
          className={cn(isFeatured && 'shadow-card')}
        />
      </Link>

      <CardLibraryActions videoId={video.id} />

      <div className={cn('min-w-0', isCompact ? 'flex-1 pt-0.5' : 'mt-3 flex gap-3')}>
        {showChannel && !isCompact ? (
          <Link
            href={routes.channel(video.channel.id)}
            aria-label={video.channel.title}
            className="mt-0.5 rounded-full"
            tabIndex={-1}
          >
            <ChannelAvatar channel={video.channel} size={isFeatured ? 'lg' : 'md'} />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'font-display font-semibold leading-snug tracking-[-0.01em] text-pretty',
              isFeatured ? 'line-clamp-2 text-lg sm:text-xl' : 'line-clamp-2 text-sm sm:text-[0.95rem]',
            )}
          >
            <Link href={watchHref} className="rounded-control hover:text-primary">
              {video.title}
            </Link>
          </h3>

          {showChannel ? (
            <Link
              href={routes.channel(video.channel.id)}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              {isCompact ? <ChannelAvatar channel={video.channel} size="sm" /> : null}
              <span className="truncate">{video.channel.title}</span>
            </Link>
          ) : null}

          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-foreground-subtle">
            {views ? <span>{views}</span> : null}
            {views && published ? <span aria-hidden>·</span> : null}
            {published ? (
              <time
                dateTime={video.publishedAt || undefined}
                title={formatAbsoluteDate(video.publishedAt)}
                suppressHydrationWarning
              >
                {published}
              </time>
            ) : null}
          </p>

          {isFeatured && video.teaser ? (
            <p className="mt-2.5 line-clamp-2 text-sm text-foreground-muted">{video.teaser}</p>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}
