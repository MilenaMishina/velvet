'use client';

import { ArrowUpRight } from 'lucide-react';
import * as React from 'react';

import { AdSlot } from '@/components/ads/ad-slot';
import { useAdConfig } from '@/components/ads/ad-config-provider';
import { SMARTLINK_HREF } from '@/lib/ads';
import { cn } from '@/lib/utils';

/**
 * Direct link.
 *
 * A hyperlink rather than a slotted unit, so it lives wherever a link belongs. The
 * destination is a sponsor's landing page: it opens in a new tab, carries
 * `rel="nofollow sponsored"` so it is never read as an endorsement from us, and it is
 * labelled — a link that is paid for and looks like navigation is the one thing
 * visitors have a right to be told about.
 */
export function AdSmartlink({ className }: { className?: string }) {
  const config = useAdConfig();
  if (!config.enabled || !config.pageScripts) return null;

  return (
    <a
      href={SMARTLINK_HREF}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className={cn(
        'panel group flex items-center justify-between gap-2 rounded-card px-3 py-2.5 transition-colors hover:border-border-strong',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Sponsored</span>
        <span className="block truncate text-sm font-medium text-foreground-muted group-hover:text-foreground">
          Sponsor offer
        </span>
      </span>
      <ArrowUpRight
        aria-hidden
        className="size-4 shrink-0 text-foreground-subtle transition-colors group-hover:text-primary"
      />
    </a>
  );
}

/**
 * The units the networks issue that fit nowhere else.
 *
 * 178×46, 258×46 and 178×18 are link-shaped and only earn where they are actually
 * seen, so they travel as one labelled band at the end of a page rather than being
 * scattered into the feed as invisible filler.
 */
export function AdPartnerBand({ className }: { className?: string }) {
  const config = useAdConfig();
  // Phone-width band = three stacked 320×50 iframes at the very bottom of every
  // page, where they are rarely seen but always paid for in memory. Desktop keeps
  // the full set.
  const [isWide, setIsWide] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const update = () => setIsWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (!config.enabled || !isWide) return null;

  return (
    <section aria-label="Partner offers" className={cn('panel space-y-3 rounded-card p-4', className)}>
      <p className="text-center text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
        Partner offers
      </p>
      <div className="flex flex-wrap items-center justify-center gap-5">
        <AdSlot placement="band-a" caption={null} />
        <AdSlot placement="band-b" caption={null} />
        <AdSlot placement="band-c" caption={null} />
      </div>
    </section>
  );
}
