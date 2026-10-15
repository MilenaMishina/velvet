import { Clapperboard, Globe2, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AdLeadStrip } from '@/components/ads/ad-banner';
import { AdNative } from '@/components/ads/ad-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { TubeFeed } from '@/components/tube/tube-feed';
import { routes } from '@/lib/routes';
import { listVideos, topSources, tubeStats } from '@/lib/tube/db';
import type { TubeSort } from '@/lib/tube/models';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Source videos',
  description: 'Videos indexed from the partner sites we follow, played from their own players and CDNs.',
};

/**
 * The database is local state that changes on every sync, so this page must never
 * be prerendered — that would also create the SQLite file at build time.
 */
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

const SORTS: ReadonlyArray<{ value: TubeSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'views', label: 'Most viewed' },
  { value: 'oldest', label: 'Oldest' },
];

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 py-2 text-xs font-semibold transition-all duration-200 ease-spring',
        active
          ? 'brand-gradient text-primary-foreground shadow-glow'
          : 'panel text-foreground-muted hover:border-border-strong hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Indexed-video feed.
 *
 * Rows here were pulled from the partner sites by the tube sync and live in our own
 * SQLite file; this page is the surface that renders them. The first page is read
 * straight from the database on the server (no HTTP round-trip), and "load more"
 * pages come from `/api/tube/videos`.
 */
export default function SourceVideosPage({
  searchParams,
}: {
  searchParams: { source?: string; sort?: string; q?: string };
}) {
  const sourceId = searchParams.source?.trim() || undefined;
  const q = searchParams.q?.trim() || undefined;
  const sortRaw = searchParams.sort;
  const sort: TubeSort = sortRaw === 'views' || sortRaw === 'oldest' ? sortRaw : 'newest';

  const result = listVideos({ q, sourceId, sort, page: 1, perPage: PAGE_SIZE });
  const sources = topSources(8);
  const stats = tubeStats();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            {q ? <Search className="size-3.5" aria-hidden /> : <Globe2 className="size-3.5" aria-hidden />}
            {q
              ? `${result.total} ${result.total === 1 ? 'match' : 'matches'}`
              : `Indexed from ${stats.sources || 'our'} ${stats.sources === 1 ? 'site' : 'sites'}`}
          </>
        }
        title={q ? `“${q}”` : 'All videos'}
        description={
          q
            ? 'Matching titles and tags across every site we index. Clear the search to browse everything.'
            : 'Every video we index, newest first. Playback always happens on the source’s own infrastructure — nothing is downloaded, copied or re-hosted, and every card links back to the original page.'
        }
      />

      <AdLeadStrip />

      <div className="space-y-3">
        <div className="fade-edge-x -mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          <ul className="flex w-max items-center gap-2 pb-1">
            <li>
              <Chip href={routes.tube.filtered({ sort })} active={!sourceId}>
                All sources
              </Chip>
            </li>
            {sources.map((source) => (
              <li key={source.id}>
                <Chip
                  href={routes.tube.filtered({ source: source.id, sort })}
                  active={sourceId === source.id}
                >
                  {source.name}
                  <span className="text-2xs opacity-70">{source.count}</span>
                </Chip>
              </li>
            ))}
          </ul>
        </div>

        <ul className="flex flex-wrap items-center gap-2">
          {SORTS.map((option) => (
            <li key={option.value}>
              <Chip
                href={routes.tube.filtered({ source: sourceId, sort: option.value })}
                active={sort === option.value}
              >
                {option.label}
              </Chip>
            </li>
          ))}
        </ul>
      </div>

      <AdNative />

      <TubeFeed
        initial={result}
        query={{ q, source: sourceId, sort, perPage: PAGE_SIZE }}
        emptyState={
          <EmptyState
            icon={q ? Search : Clapperboard}
            title={q ? `Nothing matches “${q}”` : sourceId ? 'Nothing indexed for this source yet' : 'No videos indexed yet'}
            description={
              q
                ? 'Try a shorter term — matching runs against video titles and tags.'
                : sourceId
                  ? 'This source has no rows in the local database — run a sync, or switch back to all sources.'
                  : 'The catalogue is built by the source sync, and the database only exists once it has run.'
            }
            action={
              <div className="w-full max-w-md space-y-2 text-left">
                <p className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
                  Trigger a sync
                </p>
                <code className="block overflow-x-auto rounded-control bg-surface-raised px-3 py-2 text-xs text-foreground">
                  curl http://localhost:3000/api/cron/sync?secret=dev-cron-key
                </code>
                <p className="text-xs text-foreground-subtle">
                  Or open the <Link href={routes.admin} className="font-medium text-primary hover:underline">admin console</Link>{' '}
                  and press <strong className="font-semibold text-foreground">Deep backfill</strong> — the same
                  endpoint, with the depth filled in for you.
                </p>
              </div>
            }
          />
        }
      />
    </div>
  );
}
