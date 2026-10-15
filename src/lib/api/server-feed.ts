import 'server-only';

import type { CacheResult } from '@/lib/cache';
import {
  friendlyMessage,
  isYouTubeApiError,
  toDegradedReason,
  YouTubeApiError,
} from '@/lib/youtube/errors';
import type { AppVideo, Page, ResponseMeta } from '@/lib/youtube/models';
import { snapshot } from '@/lib/youtube/quota';

export interface FeedPayload {
  items: AppVideo[];
  nextPageToken: string | null;
  totalResults: number | null;
  meta: ResponseMeta;
}

/**
 * Server-component counterpart to the API envelope.
 *
 * Pages render the first page directly (no client round-trip on load) and hand the
 * same `{ items, nextPageToken, meta }` shape to `InfiniteVideoFeed`. A failure
 * here is turned into an empty page plus degraded metadata, so a spent quota
 * renders an explanatory banner instead of throwing to the error boundary.
 */
export async function loadFeed(load: () => Promise<CacheResult<Page<AppVideo>>>): Promise<FeedPayload> {
  try {
    const result = await load();
    return {
      items: result.data.items,
      nextPageToken: result.data.nextPageToken,
      totalResults: result.data.totalResults,
      meta: { cache: result.status, ageSeconds: result.ageSeconds, quota: await snapshot() },
    };
  } catch (error) {
    const apiError = isYouTubeApiError(error)
      ? error
      : new YouTubeApiError('UPSTREAM', 'Unexpected failure talking to YouTube.');
    if (apiError.detail) console.warn(`[page] ${apiError.code}: ${apiError.detail}`);

    return {
      items: [],
      nextPageToken: null,
      totalResults: 0,
      meta: {
        cache: 'bypass',
        ageSeconds: 0,
        quota: await snapshot(),
        degraded: { reason: toDegradedReason(apiError.code), message: friendlyMessage(apiError.code) },
      },
    };
  }
}

/** Same idea for a single resource (watch page, channel header). */
export async function loadResource<T>(
  load: () => Promise<CacheResult<T>>,
): Promise<{ data: T; meta: ResponseMeta } | { data: null; meta: ResponseMeta }> {
  try {
    const result = await load();
    return {
      data: result.data,
      meta: { cache: result.status, ageSeconds: result.ageSeconds, quota: await snapshot() },
    };
  } catch (error) {
    const apiError = isYouTubeApiError(error)
      ? error
      : new YouTubeApiError('UPSTREAM', 'Unexpected failure talking to YouTube.');
    // NOT_FOUND is meaningful to callers (they render a 404), so rethrow it.
    if (apiError.code === 'NOT_FOUND') throw apiError;
    if (apiError.detail) console.warn(`[page] ${apiError.code}: ${apiError.detail}`);

    return {
      data: null,
      meta: {
        cache: 'bypass',
        ageSeconds: 0,
        quota: await snapshot(),
        degraded: { reason: toDegradedReason(apiError.code), message: friendlyMessage(apiError.code) },
      },
    };
  }
}
