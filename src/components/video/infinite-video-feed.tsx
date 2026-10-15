'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import * as React from 'react';

import { DegradedNotice } from '@/components/feedback/degraded-notice';
import { Button } from '@/components/ui/button';
import { VideoGrid } from '@/components/video/video-grid';
import { VideoGridSkeleton } from '@/components/video/video-grid-skeleton';
import {
  fetchChannelUploadsPage,
  fetchFeedPage,
  fetchPlaylistPage,
  fetchSearchPage,
  type VideoPageResult,
} from '@/lib/api/client';
import { useInView } from '@/lib/hooks/use-in-view';
import { useInfiniteVideos } from '@/lib/hooks/use-infinite-videos';
import type { AppVideo, ResponseMeta, SearchQuery } from '@/lib/youtube/models';

/** Where the next page comes from. Keeps the loader logic out of the pages. */
export type FeedSource =
  | { kind: 'feed'; category?: string | null }
  | { kind: 'search'; query: SearchQuery }
  | { kind: 'channel'; channelId: string }
  | { kind: 'playlist'; playlistId: string };

function loaderFor(source: FeedSource) {
  return (pageToken: string | null, signal: AbortSignal): Promise<VideoPageResult> => {
    switch (source.kind) {
      case 'search':
        return fetchSearchPage({ ...source.query, pageToken }, signal);
      case 'channel':
        return fetchChannelUploadsPage({ channelId: source.channelId, pageToken }, signal);
      case 'playlist':
        return fetchPlaylistPage({ playlistId: source.playlistId, pageToken }, signal);
      case 'feed':
      default:
        return fetchFeedPage({ category: source.category ?? null, pageToken }, signal);
    }
  };
}

export interface InfiniteVideoFeedProps {
  initialItems: AppVideo[];
  initialPageToken: string | null;
  initialMeta?: ResponseMeta | null;
  source: FeedSource;
  featureFirst?: boolean;
  showChannel?: boolean;
  /** Rendered when the very first page came back empty. */
  emptyState?: React.ReactNode;
}

/**
 * Server-rendered first page + client-side infinite scroll.
 *
 * The sentinel sits ~900px below the fold so the next page is usually in place
 * before the visitor reaches it, and there is always a real button as a fallback
 * for keyboard users and browsers without IntersectionObserver.
 */
export function InfiniteVideoFeed({
  initialItems,
  initialPageToken,
  initialMeta = null,
  source,
  featureFirst = false,
  showChannel = true,
  emptyState,
}: InfiniteVideoFeedProps) {
  const resetKey = React.useMemo(() => JSON.stringify(source), [source]);
  const loader = React.useMemo(() => loaderFor(source), [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const { items, isLoadingMore, hasMore, error, meta, loadMore, retry } = useInfiniteVideos({
    initialItems,
    initialPageToken,
    initialMeta,
    loader,
    resetKey,
  });

  const sentinelRef = useInView(loadMore, { enabled: hasMore && !isLoadingMore && !error });

  if (items.length === 0 && !isLoadingMore) {
    return (
      <div className="space-y-5">
        <DegradedNotice meta={meta} />
        {emptyState}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DegradedNotice meta={meta} />

      <VideoGrid videos={items} featureFirst={featureFirst} showChannel={showChannel} />

      {isLoadingMore ? <VideoGridSkeleton count={4} className="gap-y-9" /> : null}

      {error ? (
        <div className="panel flex flex-col items-center gap-3 rounded-card px-6 py-8 text-center">
          <p className="text-sm text-foreground-muted">{error}</p>
          <Button variant="outline" size="sm" pill onClick={retry}>
            <RefreshCw aria-hidden />
            Try again
          </Button>
        </div>
      ) : null}

      {hasMore && !error ? (
        <div ref={sentinelRef} className="flex justify-center pb-4 pt-2">
          <Button variant="outline" size="md" pill onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}

      {!hasMore && items.length > 0 ? (
        <p className="pb-4 text-center text-xs text-foreground-subtle">
          That’s the end of this shelf — try another category or search.
        </p>
      ) : null}
    </div>
  );
}
