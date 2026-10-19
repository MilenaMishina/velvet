'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { useAdConfig } from '@/components/ads/ad-config-provider';
import { ADSTERRA_UNITS, adsterraSnippet } from '@/lib/ads';
import { cn } from '@/lib/utils';

/**
 * The unit that sits *over* the player — a single Adsterra rectangle.
 *
 * A watch page is the most engaged moment on the site and the least served by the
 * page-level slots, which is why this one is pinned to the player rather than left in
 * the document flow. It is deliberately dismissible: an overlay a visitor cannot close
 * is how you lose the visitor and the impression with it.
 */
export function AdInVideo({ className }: { className?: string }) {
  const config = useAdConfig();
  const [dismissed, setDismissed] = React.useState(false);

  if (!config.enabled || !config.inVideo || dismissed) return null;

  const unit = ADSTERRA_UNITS.rectangle;

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

        <div className="flex items-center justify-center" style={{ minHeight: unit.height }}>
          <iframe
            title={`Advertisement ${unit.label}`}
            srcDoc={adsterraSnippet('rectangle')}
            width={unit.width}
            height={unit.height}
            loading="lazy"
            scrolling="no"
            className="block max-w-[78vw] border-0 sm:max-w-none"
          />
        </div>

        <span className="text-2xs font-semibold uppercase tracking-wider text-white/60">Ad</span>
      </div>
    </div>
  );
}
