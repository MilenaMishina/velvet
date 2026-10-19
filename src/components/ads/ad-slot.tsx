'use client';

import * as React from 'react';

import { useAdConfig } from '@/components/ads/ad-config-provider';
import { ADSTERRA_UNITS, AD_PLACEMENTS, adsterraSnippet, type AdPlacementName } from '@/lib/ads';
import { cn } from '@/lib/utils';

export interface AdSlotProps {
  placement: AdPlacementName;
  /** Layout lives with the caller — `hidden lg:flex` is how a slot picks a breakpoint. */
  className?: string;
  /** Pass null where a surrounding band already labels its units. */
  caption?: string | null;
}

/**
 * One ad slot: a single Adsterra unit, rendered directly.
 *
 * The space is reserved up front — width and height are known before the iframe is
 * requested — so a unit that loads slowly costs no layout shift, and there is no
 * second network waiting to double up with it.
 */
export function AdSlot({ placement, className, caption }: AdSlotProps) {
  const config = useAdConfig();
  const spec = AD_PLACEMENTS[placement];

  if (!config.enabled) return null;

  const unit = ADSTERRA_UNITS[spec.unit];
  const label = caption === null ? null : (caption ?? spec.caption);

  return (
    <div
      role="complementary"
      aria-label={label ?? 'Advertisement'}
      className={cn('flex w-full flex-col items-center gap-1.5', className)}
    >
      <div className="relative flex items-center justify-center" style={{ minHeight: unit.height }}>
        <iframe
          title={`Advertisement ${unit.label}`}
          srcDoc={adsterraSnippet(spec.unit)}
          width={unit.width}
          height={unit.height}
          loading="lazy"
          scrolling="no"
          className="block border-0"
          style={{ width: unit.width, height: unit.height, maxWidth: '100%' }}
        />
      </div>
      {label ? <span className="text-2xs uppercase tracking-wider text-foreground-subtle">{label}</span> : null}
    </div>
  );
}

/**
 * The opening slot of the browsing pages: the leaderboard where there is room, the
 * phone-width unit where there is not.
 *
 * Rendered with `matchMedia` rather than a `hidden` class, so only the visible unit
 * is ever mounted — a hidden iframe still asks the network for a fill, and an
 * impression nobody can see is paid for all the same.
 */
export function AdLeadStrip({ className }: { className?: string }) {
  const config = useAdConfig();
  const [wide, setWide] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Before hydration `wide` is unknown: render nothing rather than guess, because the
  // slot is a thin strip and a wrong guess shows two units stacked for a frame.
  if (!config.enabled || wide === null) {
    return <div className={cn('w-full', className)} style={{ minHeight: 50 }} aria-hidden />;
  }

  return (
    <div className={cn('flex w-full justify-center', className)}>
      <AdSlot placement={wide ? 'lead-wide' : 'lead-narrow'} />
    </div>
  );
}
