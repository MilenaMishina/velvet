import { SearchX } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/feedback/empty-state';
import { SetupNotice } from '@/components/feedback/setup-notice';
import { PageHeader } from '@/components/layout/page-header';
import { SearchFilterBar } from '@/components/search/filter-bar';
import { InfiniteVideoFeed } from '@/components/video/infinite-video-feed';
import { parseDuration, parseOrder, parseSearchTerm, parseUploadWindow } from '@/lib/api/params';
import { loadFeed } from '@/lib/api/server-feed';
import { isYouTubeConfigured } from '@/lib/env';
import { formatExactNumber } from '@/lib/format';
import { searchVideos } from '@/lib/youtube/service';

interface SearchPageProps {
  searchParams: { q?: string; order?: string; duration?: string; uploaded?: string };
}

/** Query-driven and cache-governed — always rendered per request. */
export const dynamic = 'force-dynamic';

export function generateMetadata({ searchParams }: SearchPageProps): Metadata {
  const q = parseSearchTerm(searchParams.q);
  return {
    title: q ? `“${q}”` : 'Search',
    // Result pages are ephemeral and query-driven: no value in indexing them.
    robots: { index: false, follow: true },
  };
}

/**
 * Search results.
 *
 * Filters live in the URL, so this page is a pure function of its params — which
 * is what lets the 100-unit `search.list` call be cached per query+filter+page and
 * shared between visitors.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = parseSearchTerm(searchParams.q);
  const order = parseOrder(searchParams.order);
  const duration = parseDuration(searchParams.duration);
  const uploaded = parseUploadWindow(searchParams.uploaded);

  if (!isYouTubeConfigured) return <SetupNotice />;

  if (!q) {
    return (
      <div className="space-y-8">
        <PageHeader title="Search" description="Look for a creator, a topic, or a mood." />
        <EmptyState
          title="What are you in the mood for?"
          description="Try “lofi study beats”, “rust tutorial”, or a channel name. Filters for length, upload date and sort order appear once you search."
        />
      </div>
    );
  }

  const query = { q, order, duration, uploaded };
  const feed = await loadFeed(() => searchVideos(query));
  const total = feed.totalResults;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={<>Search</>}
        title={`“${q}”`}
        description={
          total && total > 0
            ? `About ${formatExactNumber(total)} matching videos. Only embeddable results are shown.`
            : undefined
        }
      />

      <SearchFilterBar q={q} order={order} duration={duration} uploaded={uploaded} />

      <InfiniteVideoFeed
        source={{ kind: 'search', query }}
        initialItems={feed.items}
        initialPageToken={feed.nextPageToken}
        initialMeta={feed.meta}
        emptyState={
          <EmptyState
            icon={SearchX}
            title={`No results for “${q}”`}
            description="Try fewer words, check the spelling, or relax the filters — length and upload-date filters can be strict."
          />
        }
      />
    </div>
  );
}
