'use client';

import { toQuery } from '@/lib/utils';
import type { ApiEnvelope, AppVideo, Page, ResponseMeta, SearchQuery } from '@/lib/youtube/models';

/**
 * Browser-side client for our own proxy routes.
 *
 * The browser never talks to googleapis.com — it only ever calls `/api/youtube/*`,
 * which is what keeps the API key server-side and lets the cache do its job.
 */

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function getEnvelope<T>(
  path: string,
  params: Record<string, string | number | undefined | null>,
  signal?: AbortSignal,
): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${path}${toQuery(params)}`, {
    signal: signal ?? null,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    throw new ApiRequestError(body?.error?.message ?? `Request failed (${response.status}).`, response.status);
  }

  return (await response.json()) as ApiEnvelope<T>;
}

export interface VideoPageResult {
  page: Page<AppVideo>;
  meta: ResponseMeta;
}

async function videoPage(
  path: string,
  params: Record<string, string | number | undefined | null>,
  signal?: AbortSignal,
): Promise<VideoPageResult> {
  const envelope = await getEnvelope<Page<AppVideo>>(path, params, signal);
  return { page: envelope.data, meta: envelope.meta };
}

export function fetchFeedPage(
  input: { category?: string | null; pageToken?: string | null; max?: number },
  signal?: AbortSignal,
): Promise<VideoPageResult> {
  return videoPage(
    '/api/youtube/feed',
    { category: input.category ?? undefined, pageToken: input.pageToken ?? undefined, max: input.max },
    signal,
  );
}

export function fetchSearchPage(
  input: Omit<Partial<SearchQuery>, 'pageToken'> & { pageToken?: string | null },
  signal?: AbortSignal,
): Promise<VideoPageResult> {
  return videoPage(
    '/api/youtube/search',
    {
      q: input.q,
      order: input.order,
      duration: input.duration,
      uploaded: input.uploaded,
      channelId: input.channelId,
      pageToken: input.pageToken ?? undefined,
    },
    signal,
  );
}

export function fetchChannelUploadsPage(
  input: { channelId: string; pageToken?: string | null; max?: number },
  signal?: AbortSignal,
): Promise<VideoPageResult> {
  return videoPage(
    `/api/youtube/channel/${encodeURIComponent(input.channelId)}/uploads`,
    { pageToken: input.pageToken ?? undefined, max: input.max },
    signal,
  );
}

export function fetchPlaylistPage(
  input: { playlistId: string; pageToken?: string | null; max?: number },
  signal?: AbortSignal,
): Promise<VideoPageResult> {
  return videoPage(
    `/api/youtube/playlist/${encodeURIComponent(input.playlistId)}/items`,
    { pageToken: input.pageToken ?? undefined, max: input.max },
    signal,
  );
}

/** Hydrate locally saved ids (max 50 per call — one quota unit). */
export function fetchVideosByIds(ids: readonly string[], signal?: AbortSignal): Promise<VideoPageResult> {
  return videoPage('/api/youtube/videos', { ids: ids.slice(0, 50).join(',') }, signal);
}

export function fetchRelated(videoId: string, signal?: AbortSignal): Promise<VideoPageResult> {
  return videoPage('/api/youtube/related', { videoId }, signal);
}
