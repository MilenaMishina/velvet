'use client';

import * as React from 'react';

import type { VideoPageResult } from '@/lib/api/client';
import { uniqueBy } from '@/lib/utils';
import type { AppVideo, ResponseMeta } from '@/lib/youtube/models';

export type PageLoader = (pageToken: string | null, signal: AbortSignal) => Promise<VideoPageResult>;

export interface InfiniteVideosState {
  items: AppVideo[];
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  meta: ResponseMeta | null;
  loadMore: () => void;
  retry: () => void;
}

export interface UseInfiniteVideosOptions {
  initialItems: AppVideo[];
  initialPageToken: string | null;
  loader: PageLoader;
  /** Change this (category, query, filters…) to reset the list. */
  resetKey: string;
  initialMeta?: ResponseMeta | null;
}

/**
 * Cursor pagination over one of our feed endpoints.
 *
 * The first page always arrives from the server render, so this hook only fetches
 * *subsequent* pages — that keeps the initial paint fast and avoids paying for the
 * same page twice. Requests are aborted on reset/unmount and results de-duplicated
 * by video id, because YouTube pages can overlap.
 */
export function useInfiniteVideos({
  initialItems,
  initialPageToken,
  loader,
  resetKey,
  initialMeta = null,
}: UseInfiniteVideosOptions): InfiniteVideosState {
  const [items, setItems] = React.useState(initialItems);
  const [pageToken, setPageToken] = React.useState(initialPageToken);
  const [isLoadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<ResponseMeta | null>(initialMeta);

  const controllerRef = React.useRef<AbortController | null>(null);
  const loaderRef = React.useRef(loader);
  loaderRef.current = loader;

  // A new resetKey means a different feed: drop everything and adopt the new SSR page.
  React.useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setItems(initialItems);
    setPageToken(initialPageToken);
    setError(null);
    setLoadingMore(false);
    setMeta(initialMeta);
    // `initialItems` is a fresh array on every server render; resetKey is the real signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  React.useEffect(() => () => controllerRef.current?.abort(), []);

  const fetchPage = React.useCallback(
    async (token: string | null) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoadingMore(true);
      setError(null);
      try {
        const result = await loaderRef.current(token, controller.signal);
        if (controller.signal.aborted) return;
        setItems((current) => uniqueBy([...current, ...result.page.items], (video) => video.id));
        setPageToken(result.page.nextPageToken);
        setMeta(result.meta);
      } catch (cause) {
        if (controller.signal.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        setError(cause instanceof Error ? cause.message : 'Could not load more videos.');
      } finally {
        if (!controller.signal.aborted) setLoadingMore(false);
      }
    },
    [],
  );

  const loadMore = React.useCallback(() => {
    if (isLoadingMore || !pageToken) return;
    void fetchPage(pageToken);
  }, [fetchPage, isLoadingMore, pageToken]);

  const retry = React.useCallback(() => {
    void fetchPage(pageToken);
  }, [fetchPage, pageToken]);

  return {
    items,
    isLoadingMore,
    hasMore: Boolean(pageToken),
    error,
    meta,
    loadMore,
    retry,
  };
}
