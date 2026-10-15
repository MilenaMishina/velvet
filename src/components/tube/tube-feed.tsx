'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import * as React from 'react';

import { TubeGrid, TubeGridSkeleton } from '@/components/tube/tube-grid';
import { Button } from '@/components/ui/button';
import { fetchTubePage, type TubeQuery } from '@/lib/tube/api';
import { useInView } from '@/lib/hooks/use-in-view';
import type { TubeFeedResult, TubeVideo } from '@/lib/tube/models';
import { uniqueBy } from '@/lib/utils';

export interface TubeFeedProps {
  /** First page, already rendered on the server. */
  initial: TubeFeedResult;
  /** The filters the server used, replayed for every subsequent page. */
  query: TubeQuery;
  /** Rendered when there is nothing to show at all. */
  emptyState?: React.ReactNode;
}

/**
 * Server-rendered first page + client-side pagination.
 *
 * The tube feed pages by number rather than by cursor, so this is a deliberately
 * small cousin of `useInfiniteVideos`: it keeps the accumulated items, asks for
 * `page + 1` when the sentinel approaches, and de-duplicates by id because a
 * sync running between two requests can shift rows between pages.
 */
export function TubeFeed({ initial, query, emptyState }: TubeFeedProps) {
  const [items, setItems] = React.useState<TubeVideo[]>(initial.items);
  const [page, setPage] = React.useState(initial.page);
  const [hasMore, setHasMore] = React.useState(initial.hasMore);
  const [total, setTotal] = React.useState(initial.total);
  const [isLoading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const controllerRef = React.useRef<AbortController | null>(null);
  const queryRef = React.useRef(query);
  queryRef.current = query;
  const resetKey = JSON.stringify(query);

  // A different filter set is a different feed: adopt the fresh server page.
  React.useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setItems(initial.items);
    setPage(initial.page);
    setHasMore(initial.hasMore);
    setTotal(initial.total);
    setError(null);
    setLoading(false);
    // `initial` is a fresh object every server render; resetKey is the real signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  React.useEffect(() => () => controllerRef.current?.abort(), []);

  const loadNext = React.useCallback(async () => {
    if (controllerRef.current) return; // A page is already in flight.
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchTubePage({ ...queryRef.current, page: page + 1 }, controller.signal);
      if (controller.signal.aborted) return;
      setItems((current) => uniqueBy([...current, ...next.items], (video) => video.id));
      setPage(next.page);
      setHasMore(next.hasMore);
      setTotal(next.total);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Could not load more videos.');
    } finally {
      controllerRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page]);

  const sentinelRef = useInView(() => void loadNext(), { enabled: hasMore && !isLoading && !error });

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="space-y-8">
      <TubeGrid videos={items} />

      {isLoading ? <TubeGridSkeleton count={4} className="gap-y-9" /> : null}

      <p className="text-xs text-foreground-subtle" aria-live="polite">
        Showing {items.length} of {total} indexed {total === 1 ? 'video' : 'videos'}.
      </p>

      {error ? (
        <div className="panel flex flex-col items-center gap-3 rounded-card px-6 py-8 text-center">
          <p className="text-sm text-foreground-muted">{error}</p>
          <Button variant="outline" size="sm" pill onClick={() => void loadNext()}>
            <RefreshCw aria-hidden />
            Try again
          </Button>
        </div>
      ) : null}

      {hasMore && !error ? (
        <div ref={sentinelRef} className="flex justify-center pb-4 pt-2">
          <Button variant="outline" size="md" pill onClick={() => void loadNext()} disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isLoading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
