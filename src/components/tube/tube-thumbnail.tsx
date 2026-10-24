'use client';

import Image from 'next/image';
import { Play } from 'lucide-react';
import * as React from 'react';

import { HoverPreview } from '@/components/tube/hover-preview';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface TubeThumbnailProps {
  src: string | null;
  title: string;
  durationSeconds: number | null;
  sizes: string;
  /**
   * Direct media URL — when present, resting on the card starts a silent preview.
   * The watch page plays the exact same URL, so this costs no extra infrastructure.
   */
  hoverSrc?: string | null;
  /**
   * Canonical page on the source site; when present a subtle "open original"
   * affordance fades in on hover, keeping publisher attribution one click away
   * without cluttering every card with a permanently visible badge.
   */
  pageUrl?: string;
  sourceName?: string;
  /**
   * Poster shape, width ÷ height. The frame matches the artwork instead of
   * cropping it — Desi Hub's stills are portrait, so a 16:9 frame would cut the
   * subject out of most of its catalogue.
   */
  aspectRatio?: number;
  /**
   * Force a 16:9 frame and centre-crop whatever the poster's real shape is. Used
   * by the horizontal shelves, where a portrait poster would make one card three
   * times the height of its neighbours and wreck the rail.
   */
  uniform?: boolean;
  priority?: boolean;
  className?: string;
}

/**
 * Thumbnail frame for an indexed video.
 *
 * Source posters load straight from the originating CDN — unoptimized on purpose,
 * the image never round-trips through our optimizer. A null URL (some listings
 * hide their poster) or a failed load degrades to a titled placeholder instead of
 * a broken image icon.
 */
export function TubeThumbnail({
  src,
  title,
  durationSeconds,
  sizes,
  hoverSrc,
  pageUrl,
  sourceName,
  aspectRatio = 16 / 9,
  uniform,
  priority,
  className,
}: TubeThumbnailProps) {
  const [failed, setFailed] = React.useState(false);
  const duration = formatDuration(durationSeconds);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      style={{ aspectRatio: String(uniform ? 16 / 9 : aspectRatio) }}
      className={cn(
        'card-lux relative isolate overflow-hidden rounded-card bg-surface-sunken ring-1 ring-border/70',
        className,
      )}
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
          className="object-cover transition-transform duration-700 ease-out-quint group-hover/card:scale-[1.06]"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-raised to-surface-sunken p-4"
        >
          <span className="line-clamp-3 text-center text-xs font-medium text-foreground-subtle">{title}</span>
        </div>
      )}

      {/* The silent preview that makes the grid feel alive — direct-file rows only. */}
      {hoverSrc && !failed ? (
        <HoverPreview
          src={hoverSrc}
          poster={src}
          className="absolute inset-0 size-full rounded-card object-cover opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
        />
      ) : null}

      {/* Hover affordances: deepened scrim, a play glyph fading in at the centre. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-60 transition-opacity duration-300 group-hover/card:opacity-90"
      />
      <div
        aria-hidden
        className="absolute inset-0 grid place-items-center opacity-0 transition-all duration-300 group-hover/card:opacity-100"
      >
        <span className="brand-gradient grid size-14 scale-75 place-items-center rounded-full shadow-glow transition-transform duration-300 ease-spring group-hover/card:scale-100">
          <Play className="size-6 translate-x-[1px] text-primary-foreground" fill="currentColor" aria-hidden />
        </span>
      </div>

      {/* Duration, bottom-right where every tube puts it. */}
      {duration ? (
        <span
          aria-label={`${durationSeconds ?? 0} seconds`}
          className="absolute bottom-2 right-2 z-10 rounded-md bg-black/75 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-white backdrop-blur-sm"
        >
          {duration}
        </span>
      ) : null}

      {/* Attribution, quiet and always present: the site this scene came from. */}
      {sourceName ? (
        <span className="absolute bottom-2 left-2 z-10 max-w-[60%] truncate rounded-md bg-black/60 px-1.5 py-0.5 text-2xs font-medium text-white/90 backdrop-blur-sm">
          {sourceName}
        </span>
      ) : null}

      {/* One-click path to the original page, visible only while hovering. */}
      {pageUrl ? (
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Open the original on ${sourceName ?? 'the source site'}`}
          className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-black/60 text-white/85 opacity-0 backdrop-blur-sm transition-all duration-300 hover:bg-black/80 hover:text-white focus-visible:opacity-100 group-hover/card:opacity-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden>
            <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}
