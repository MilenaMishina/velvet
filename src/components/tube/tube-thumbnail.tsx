'use client';

import Image from 'next/image';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { formatDuration, formatDurationLabel } from '@/lib/format';
import type { TubeEmbedType } from '@/lib/tube/models';
import { cn } from '@/lib/utils';

export interface TubeThumbnailProps {
  src: string | null;
  title: string;
  durationSeconds: number | null;
  /** Badge shown top-left so it is obvious how (or whether) this plays. */
  embedType: TubeEmbedType;
  sizes: string;
  /**
   * Poster shape, width ÷ height. The frame matches the artwork instead of
   * cropping it — Desi Hub's stills are portrait, so a 16:9 frame would cut the
   * subject out of most of its catalogue.
   */
  aspectRatio?: number;
  priority?: boolean;
  className?: string;
}

const EMBED_BADGE: Record<TubeEmbedType, { label: string; tone: 'primary' | 'accent' | 'neutral' }> = {
  iframe: { label: 'Embed', tone: 'primary' },
  video: { label: 'Direct', tone: 'accent' },
  link: { label: 'Source link', tone: 'neutral' },
};

/**
 * Thumbnail for an indexed video.
 *
 * Source thumbnails are loaded straight from the originating CDN — we neither copy
 * nor proxy them — so `unoptimized` is deliberate: the image never round-trips
 * through our optimizer. A null URL (some listings hide their poster) or a failed
 * load degrades to a titled placeholder instead of a broken image icon.
 */
export function TubeThumbnail({
  src,
  title,
  durationSeconds,
  embedType,
  sizes,
  aspectRatio = 16 / 9,
  priority,
  className,
}: TubeThumbnailProps) {
  const [failed, setFailed] = React.useState(false);
  const duration = formatDuration(durationSeconds);
  const badge = EMBED_BADGE[embedType];
  const showImage = Boolean(src) && !failed;

  return (
    <div
      style={{ aspectRatio: String(aspectRatio) }}
      className={cn('relative isolate overflow-hidden rounded-card bg-surface-sunken', className)}
    >
      {showImage ? (
        <Image
          src={src as string}
          alt=""
          fill
          unoptimized
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
          className="object-cover transition-transform duration-500 ease-out-quint group-hover:scale-[1.04]"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-raised to-surface-sunken p-4"
        >
          <span className="line-clamp-3 text-center text-xs font-medium text-foreground-subtle">{title}</span>
        </div>
      )}

      {/* Contrast scrim keeps the overlay badges legible on bright posters. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent opacity-80"
      />

      <div className="absolute left-2 top-2 z-10">
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
        {duration ? (
          <Badge tone="overlay" aria-label={formatDurationLabel(durationSeconds)}>
            {duration}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
