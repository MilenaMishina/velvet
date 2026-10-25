'use client';

import Image from 'next/image';
import Link from 'next/link';
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
   * affordance fades in on hover, keeping publisher attribution one click away.
   */
  pageUrl?: string;
  sourceName?: string;
  /**
   * Our play page. Rendered as a full-frame link *inside* the frame so the
   * attribution link can be its sibling — an anchor inside an anchor is invalid
   * HTML, and the parser rewriting the DOM is what used to break hydration on
   * every grid page.
   */
  href?: string;
  /**
   * Poster shape, width ÷ height. Cards force 16:9 (the tube standard); this is
   * only honoured by surfaces that deliberately show native artwork.
   */
  aspectRatio?: number;
  /** Force a 16:9 frame and centre-crop the poster. On by default. */
  uniform?: boolean;
  priority?: boolean;
  className?: string;
  /** Larger play glyph + softer scrim for the homepage hero. */
  feature?: boolean;
}

/**
 * Thumbnail frame for an indexed video.
 *
 * Source posters load straight from the originating CDN — unoptimized on purpose,
 * the image never round-trips through our optimizer. A null URL (some listings
 * hide their poster) or a failed load degrades to a titled placeholder instead of
 * a broken image icon.
 *
 * The frame is a strict 16:9 crop: every card in a row is the same height, which
 * is what makes a wall of thumbnails read as a tube grid rather than a gallery.
 */
export function TubeThumbnail({
  src,
  title,
  durationSeconds,
  sizes,
  hoverSrc,
  pageUrl,
  sourceName,
  href,
  aspectRatio = 16 / 9,
  uniform = true,
  priority,
  className,
  feature,
}: TubeThumbnailProps) {
  const [failed, setFailed] = React.useState(false);
  const duration = formatDuration(durationSeconds);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      style={{ aspectRatio: String(uniform ? 16 / 9 : aspectRatio) }}
      className={cn(
        'card-lux relative isolate w-full overflow-hidden rounded-lg bg-surface-sunken ring-1 ring-white/[0.06]',
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
          decoding="async"
          onError={() => setFailed(true)}
          // Crop anchor top: when a uniform frame must crop a taller poster, the
          // subject's face lives at the top — centring the crop beheads it.
          className="object-cover object-top transition-transform duration-[600ms] ease-out-quint group-hover/card:scale-[1.04]"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-raised to-surface-sunken p-4"
        >
          <span className="line-clamp-3 text-center text-xs font-medium text-foreground-subtle">{title}</span>
        </div>
      )}

      {/* Silent preview — direct-file rows only. */}
      {hoverSrc && !failed ? (
        <HoverPreview
          src={hoverSrc}
          poster={src}
          className="absolute inset-0 size-full object-cover object-top opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
        />
      ) : null}

      {/* Bottom scrim: makes the chips legible over busy posters without dimming
          the artwork the way a full overlay does. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
      />

      {/* Hover play glyph. */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover/card:opacity-100',
          feature && 'opacity-100',
        )}
      >
        <span
          className={cn(
            'heat-gradient grid place-items-center rounded-full shadow-glow transition-transform duration-300 ease-spring',
            feature ? 'size-16' : 'size-12 scale-75 group-hover/card:scale-100',
          )}
        >
          <Play
            className={cn('translate-x-[1px] text-primary-foreground', feature ? 'size-7' : 'size-5')}
            fill="currentColor"
            aria-hidden
          />
        </span>
      </div>

      {duration ? (
        <span
          aria-label={`${durationSeconds ?? 0} seconds`}
          className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded bg-black/85 px-1.5 py-0.5 text-[0.68rem] font-bold leading-4 tabular-nums text-white"
        >
          {duration}
        </span>
      ) : null}

      {sourceName ? (
        <span className="pointer-events-none absolute left-1.5 top-1.5 z-10 max-w-[70%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-white/90 backdrop-blur-[2px]">
          {sourceName}
        </span>
      ) : null}

      {href ? (
        <Link
          href={href}
          aria-label={title || 'Watch video'}
          className="absolute inset-0 z-[5] rounded-lg focus-visible:outline-none"
        />
      ) : null}

      {pageUrl ? (
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Open the original on ${sourceName ?? 'the source site'}`}
          className="absolute right-1.5 top-1.5 z-20 grid size-7 place-items-center rounded bg-black/60 text-white/85 opacity-0 backdrop-blur-sm transition-all duration-300 hover:bg-black/85 hover:text-white focus-visible:opacity-100 group-hover/card:opacity-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3" aria-hidden>
            <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}
