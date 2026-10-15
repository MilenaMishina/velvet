'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { useAdConfig } from '@/components/ads/ad-config-provider';
import { useJuicyZone } from '@/components/ads/ad-slot';
import { ADSTERRA_UNITS, JUICY_ZONES, adsterraSnippet } from '@/lib/ads';
import { cn } from '@/lib/utils';

/**
 * The unit that sits *over* the player.
 *
 * A watch page is the most engaged moment on the site and the least served by the
 * page-level slots, which is why this one is pinned to the player rather than left in
 * the document flow. It is deliberately dismissible: an overlay a visitor cannot close
 * is how you lose the visitor and the impression with it.
 *
 * Same rule as every other slot — JuicyAds first, an Adsterra unit only when the zone
 * does not fill.
 */
export function AdInVideo({ className }: { className?: string }) {
  const config = useAdConfig();
  const [dismissed, setDismissed] = React.useState(false);
  const zone = config.juicyAds ? JUICY_ZONES.inVideo : null;
  const { useStandIn, containerRef } = useJuicyZone(zone);

  if (!config.enabled || !config.inVideo || dismissed) return null;

  const standIn = config.adsterraFallback ? ADSTERRA_UNITS.rectangle : null;
  if (!zone && !standIn) return null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 sm:p-3',
        className,
      )}
    >
      <div className="pointer-events-auto relative flex flex-col items-center gap-1 rounded-control border border-white/10 bg-black/75 p-1.5 shadow-lifted backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hide advertisement"
          className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-border bg-surface-raised text-foreground-muted transition-colors hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>

        <div ref={containerRef} className="flex items-center justify-center" style={{ minHeight: 250 }}>
          {useStandIn && standIn ? (
            <iframe
              title={`Advertisement ${standIn.label}`}
              srcDoc={adsterraSnippet('rectangle')}
              width={standIn.width}
              height={standIn.height}
              loading="lazy"
              scrolling="no"
              className="block max-w-[78vw] border-0 sm:max-w-none"
            />
          ) : null}
        </div>

        <span className="text-2xs font-semibold uppercase tracking-wider text-white/60">Ad</span>
      </div>
    </div>
  );
}
