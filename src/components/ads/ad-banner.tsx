'use client';

import * as React from 'react';

import { AD_UNITS, adsEnabled, bannerSnippet, type AdSize } from '@/lib/ads';
import { useInView } from '@/lib/hooks/use-in-view';
import { cn } from '@/lib/utils';

export interface AdBannerProps {
  size: AdSize;
  /** Layout lives with the caller — `hidden lg:block` is how a slot picks its breakpoint. */
  className?: string;
  /** Hide the "Advertisement" mark only where the slot already sits under one. */
  labelled?: boolean;
}

/**
 * One banner slot.
 *
 * The frame is only created once the slot is near the viewport, and the reserved
 * space keeps its height either way — a feed of 24 cards should not pay for ads the
 * visitor never scrolls to, and nothing should jump when one does load.
 */
export function AdBanner({ size, className, labelled = true }: AdBannerProps) {
  const unit = AD_UNITS[size];
  const [nearViewport, setNearViewport] = React.useState(false);
  const ref = useInView(() => setNearViewport(true), {
    rootMargin: '400px 0px',
    enabled: adsEnabled,
  });

  if (!adsEnabled) return null;

  return (
    <div
      ref={ref}
      role="complementary"
      aria-label={`Advertisement ${unit.label}`}
      className={cn('flex w-full flex-col items-center gap-1.5', className)}
    >
      {nearViewport ? (
        <iframe
          title={`Advertisement ${unit.label}`}
          srcDoc={bannerSnippet(size)}
          width={unit.width}
          height={unit.height}
          loading="lazy"
          scrolling="no"
          className="block border-0"
          style={{ width: unit.width, height: unit.height, maxWidth: '100%' }}
        />
      ) : (
        <span
          aria-hidden
          className="block"
          style={{ width: unit.width, height: unit.height, maxWidth: '100%' }}
        />
      )}
      {labelled ? (
        <span className="text-2xs uppercase tracking-wider text-foreground-subtle">Advertisement</span>
      ) : null}
    </div>
  );
}

/**
 * The one slot that every browsing page opens with: the leaderboard where there is
 * room for it, and the phone-width unit where there is not. Both are the same
 * placement, so only the visible one is ever fetched.
 */
export function AdLeadStrip({ className }: { className?: string }) {
  return (
    <div className={cn('flex w-full justify-center', className)}>
      <AdBanner size="leaderboard" className="hidden sm:flex" />
      <AdBanner size="mobile" className="sm:hidden" />
    </div>
  );
}
