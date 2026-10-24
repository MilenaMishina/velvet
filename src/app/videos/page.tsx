import { Clapperboard, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AdLeadStrip, AdSlot } from '@/components/ads/ad-slot';
import { AdNative } from '@/components/ads/ad-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { TubeFeed } from '@/components/tube/tube-feed';
import { routes } from '@/lib/routes';
import { listVideos, topSources, tubeStats } from '@/lib/tube/db';
import type { TubeSort } from '@/lib/tube/models';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'All videos',
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
    <Link href={href} aria-current={active ? 'page' : undefined} className={cn('chip', active && 'chip-active')}>
      {children}
    </Link>
  );
}

/**
 * Indexed-video feed.
 *
 * Rows here were pulled from the partner sites by the tube sync and live in our
 * own SQLite file. Filters compose freely: source × tag × sort. The first page is
 * read straight from the database on the server, and "load more" pages come from
 * our own API.
 */
export default function SourceVideosPage({
  searchParams,
}: {
  searchParams: { source?: string; sort?: string; q?: string; tag?: string };
}) {
  const sourceId = searchParams.source?.trim() || undefined;
  const q = searchParams.q?.trim() || undefined;
  const tag = searchParams.tag?.trim() || undefined;
  const sortRaw = searchParams.sort;
  const sort: TubeSort = sortRaw === 'views' || sortRaw === 'oldest' ? sortRaw : 'newest';

  const result = listVideos({ q, sourceId, tag, sort, page: 1, perPage: PAGE_SIZE });
  const sources = topSources(8);
  const stats = tubeStats();

  const filtered = Boolean(sourceId || tag || q);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            {q ? <Search className="size-3.5" aria-hidden /> : <Clapperboard className="size-3.5" aria-hidden />}
            {`${result.total} ${result.total === 1 ? 'video' : 'videos'}`}
            {q ? ` for “${q}”` : tag ? ` tagged “${tag}”` : ''}
          </>
        }
        title={q ? `“${q}”` : tag ? `#${tag}` : 'All videos'}
        description={
          filtered
            ? 'One filter is active — clear it, or combine it with the rails below.'
            : `Everything we index. Playback always happens on the source's own infrastructure — nothing is downloaded, copied or re-hosted, and every card links back to the original page. Indexed from ${stats.sources} ${
                stats.sources === 1 ? 'site' : 'sites'
              }.`
        }
      />

      <AdLeadStrip />

      <div className="space-y-3">
        <div className="fade-edge-x -mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          <ul className="flex w-max items-center gap-2 pb-1">
            <li>
              <Chip href={routes.tube.filtered({ sort, tag })} active={!sourceId}>
                All sources
              </Chip>
            </li>
            {sources.map((source) => (
              <li key={source.id}>
                <Chip
                  href={routes.tube.filtered({ source: source.id, sort, tag })}
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
                href={routes.tube.filtered({ source: sourceId, sort: option.value, tag })}
                active={sort === option.value}
              >
                {option.label}
              </Chip>
            </li>
          ))}
          {tag ? (
            <li>
              <Chip href={routes.tube.filtered({ source: sourceId, sort })} active>
                #{tag}
                <span aria-hidden>×</span>
              </Chip>
            </li>
          ) : null}
        </ul>
      </div>

      <AdSlot placement="feed-billboard" />

      <AdSlot placement="feed-rectangle" />

      <AdNative />

      <TubeFeed
        initial={result}
        query={{ q, source: sourceId, tag, sort, perPage: PAGE_SIZE }}
        emptyState={
          <EmptyState
            icon={q ? Search : Clapperboard}
            title={
              q
                ? `Nothing matches “${q}”`
                : tag
                  ? `Nothing tagged “${tag}”`
                  : sourceId
                    ? 'Nothing indexed for this source yet'
                    : 'No videos indexed yet'
            }
            description={
              q
                ? 'Try a shorter term — matching runs against video titles and tags.'
                : tag
                  ? 'This tag exists in the cloud but has no published rows on this page — it may carry only hidden rows.'
                  : sourceId
                    ? 'This source has no rows in the local database — run a sync, or switch back to all sources.'
                    : 'The catalogue is built by the source sync, and the database only exists once it has run.'
            }
          />
        }
      />
    </div>
  );
}
