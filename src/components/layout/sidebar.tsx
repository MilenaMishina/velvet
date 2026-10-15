'use client';

import { Globe2, Home, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { AdBanner } from '@/components/ads/ad-banner';
import { AdSmartlink } from '@/components/ads/ad-smartlink';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTubeSources } from '@/lib/hooks/use-tube-sources';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface RowProps {
  href: string;
  label: string;
  /** Any component that accepts a className — Lucide icons and our own wrappers. */
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  trailing?: React.ReactNode;
  collapsed: boolean;
}

/**
 * One nav row.
 *
 * Collapsed, it becomes an icon-only square: the label is dropped from view but kept
 * as the accessible name and the hover tooltip, so nothing is lost to a screen
 * reader or an impatient mouse.
 */
function Row({ href, label, Icon, active, trailing, collapsed }: RowProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        'group/row relative flex items-center rounded-control text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
        active ? 'text-foreground' : 'text-foreground-muted hover:bg-surface-raised/70 hover:text-foreground',
      )}
    >
      {active ? <span aria-hidden className="absolute inset-0 -z-10 rounded-control bg-surface-raised" /> : null}
      {active ? (
        <span aria-hidden className="brand-gradient absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-pill" />
      ) : null}
      <Icon className="size-4 shrink-0" />
      {collapsed ? null : <span className="truncate">{label}</span>}
      {collapsed || !trailing ? null : <span className="ml-auto">{trailing}</span>}
    </Link>
  );
}

/** Section heading; in the collapsed rail it becomes a hairline instead of words. */
function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <span aria-hidden className="hairline mx-2 my-2 block h-px" />;
  return (
    <h2 className="px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">{children}</h2>
  );
}

/**
 * Desktop sidebar: primary nav, then a rail of the sites we index — one row per
 * source, each opening just that source's videos, with its count.
 */
export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const sources = useTubeSources();

  const activeSource = params.get('source');
  const viewingTube = pathname === routes.tube.index || pathname.startsWith(`${routes.tube.index}/`);
  const isHome = pathname === '/';
  // "Trending" and "All videos" are the same route with different ordering.
  const isTrending = viewingTube && params.get('sort') === 'views';
  const isSources = viewingTube && !isTrending;

  return (
    <ScrollArea className="h-full">
      <nav aria-label="Browse" className={cn('space-y-5 pb-10 pt-5', collapsed ? 'px-2' : 'px-3')}>
        <ul className="space-y-0.5">
          <li>
            <Row href={routes.home} label="Home" Icon={Home} active={isHome} collapsed={collapsed} />
          </li>
          <li>
            <Row href={routes.trending} label="Trending now" Icon={TrendingUp} active={isTrending} collapsed={collapsed} />
          </li>
          <li>
            <Row href={routes.tube.index} label="All videos" Icon={Globe2} active={isSources} collapsed={collapsed} />
          </li>
        </ul>

        <div>
          <SectionLabel collapsed={collapsed}>Categories</SectionLabel>
          <ul className="space-y-0.5">
            {sources.map((source) => (
              <li key={source.id}>
                <Row
                  href={routes.tube.filtered({ source: source.id })}
                  label={source.count > 0 ? `${source.name} — ${source.count} videos` : source.name}
                  Icon={Globe2}
                  active={isSources && activeSource === source.id}
                  trailing={source.count > 0 ? <Badge tone="neutral">{source.count}</Badge> : undefined}
                  collapsed={collapsed}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* The rail is the one column that stays in view while the feed scrolls, so
            it carries the two vertical units. Both are dropped in the collapsed rail,
            which is narrower than the ads themselves. */}
        {collapsed ? null : (
          <div className="space-y-3 px-3">
            <AdBanner size="halfpage" />
            <AdBanner size="skyscraper" />
            <AdSmartlink />
          </div>
        )}

        {collapsed ? null : (
          <p className="px-3 text-2xs leading-relaxed text-foreground-subtle">
            Every video streams from the site that published it. We index the metadata and frame the publisher’s own
            player — nothing is copied, cached or re-hosted.
          </p>
        )}
      </nav>
    </ScrollArea>
  );
}

/** Placeholder with the same rhythm as the real sidebar, shown while it hydrates. */
export function SidebarFallback() {
  return (
    <div className="space-y-7 px-3 pb-10 pt-5" aria-hidden>
      {[2, 3, 8].map((rows, group) => (
        <div key={group} className="space-y-1">
          {group > 0 ? <div className="mb-2 ml-3 h-2.5 w-20 rounded-pill bg-surface-raised/70" /> : null}
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className="flex items-center gap-3 px-3 py-2.5">
              <span className="size-4 rounded bg-surface-raised/70" />
              <span className="h-2.5 flex-1 rounded-pill bg-surface-raised/70" style={{ maxWidth: `${60 + row * 6}%` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
