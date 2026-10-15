'use client';

import Image from 'next/image';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { formatDuration, formatDurationLabel } from '@/lib/format';
import { buildEmbedUrl, EMBED_IFRAME_PROPS, previewStartSeconds } from '@/lib/youtube/embed';
import { cn } from '@/lib/utils';
import type { AppVideo } from '@/lib/youtube/models';

export interface VideoThumbnailProps {
  video: AppVideo;
  /** Mount the muted preview player. Parent owns the hover/focus intent. */
  previewing?: boolean;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/**
 * Thumbnail with duration badge and an optional muted preview.
 *
 * The preview is the *official* embed player started a little way into the video,
 * muted, chrome-less and pointer-transparent — a compliant stand-in for YouTube's
 * animated previews (we never generate or host a clip ourselves). It is only
 * mounted while hovering, so a feed of 40 cards never holds 40 iframes.
 */
export function VideoThumbnail({ video, previewing = false, sizes, priority, className }: VideoThumbnailProps) {
  const duration = formatDuration(video.durationSeconds);
  const [previewReady, setPreviewReady] = React.useState(false);

  React.useEffect(() => {
    if (!previewing) setPreviewReady(false);
  }, [previewing]);

  const previewSrc = React.useMemo(() => {
    if (!previewing) return null;
    const start = previewStartSeconds(video.durationSeconds);
    return buildEmbedUrl(video.id, {
      autoplay: true,
      mute: true,
      controls: false,
      start,
      end: start + 14,
      loop: false,
    });
  }, [previewing, video.durationSeconds, video.id]);

  return (
    <div className={cn('relative isolate aspect-video overflow-hidden rounded-card bg-surface-sunken', className)}>
      <Image
        src={video.thumbnail.url}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className={cn(
          'object-cover transition-[transform,opacity] duration-500 ease-out-quint',
          previewReady ? 'scale-105 opacity-0' : 'group-hover:scale-[1.04]',
        )}
      />

      {previewSrc ? (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 z-10 transition-opacity duration-500',
            previewReady ? 'opacity-100' : 'opacity-0',
          )}
        >
          <iframe
            key={previewSrc}
            src={previewSrc}
            title=""
            tabIndex={-1}
            onLoad={() => setPreviewReady(true)}
            // Overscaled so the player's letterboxing is cropped out of frame.
            className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 scale-[1.38] border-0"
            {...EMBED_IFRAME_PROPS}
          />
        </div>
      ) : null}

      {/* Contrast scrim so white overlay text stays legible on bright thumbnails. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/70 to-transparent opacity-80"
      />

      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5">
        {video.isLive ? (
          <Badge tone="live" className="gap-1">
            <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />
            Live
          </Badge>
        ) : video.isUpcoming ? (
          <Badge tone="overlay">Upcoming</Badge>
        ) : duration ? (
          <Badge tone="overlay" aria-label={formatDurationLabel(video.durationSeconds)}>
            {duration}
          </Badge>
        ) : null}
        {video.definition === 'hd' && !video.isLive ? <Badge tone="overlay">HD</Badge> : null}
      </div>
    </div>
  );
}
