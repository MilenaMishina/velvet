import { ArrowUpRight } from 'lucide-react';

import { adsEnabled, smartlink } from '@/lib/ads';
import { cn } from '@/lib/utils';

/**
 * Direct link.
 *
 * A hyperlink rather than a slotted unit, so it lives wherever a link belongs. The
 * destination is a sponsor's landing page: it opens in a new tab, carries
 * `rel="nofollow sponsored"` so it is never read as an endorsement from us, and it
 * is labelled, because a link that is paid for and looks like navigation is the one
 * thing visitors have a right to be told about.
 */
export function AdSmartlink({ className }: { className?: string }) {
  if (!adsEnabled) return null;

  return (
    <a
      href={smartlink.href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className={cn(
        'panel group flex items-center justify-between gap-2 rounded-card px-3 py-2.5 transition-colors hover:border-border-strong',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
          Sponsored
        </span>
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
