import 'server-only';

import { cached, type CacheResult } from '@/lib/cache';
import { serverEnv } from '@/lib/env';
import { clamp, stableKey } from '@/lib/utils';
import { callYouTube } from '@/lib/youtube/client';
import type { AppVideo, Page } from '@/lib/youtube/models';
import { hasHeadroom } from '@/lib/youtube/quota';
import { toAppVideo, toAppVideoFromSearch } from '@/lib/youtube/transform';
import type { YouTubeListResponse, YouTubeSearchItem, YouTubeVideoItem } from '@/lib/youtube/types';
import { decorateVideos, getVideosByIds, primeVideoCache, TTL } from '@/lib/youtube/service/shared';

export interface FeedOptions {
  /** YouTube category id (not our slug). Omit for the all-round trending chart. */
  categoryId?: string | null;
  pageToken?: string | null;
  regionCode?: string;
  maxResults?: number;
}

/**
 * Home / category feed.
 *
 * Deliberately built on `videos.list?chart=mostPopular` (1 unit) instead of
 * `search.list` (100 units) — a 100× quota saving for the app's busiest surface,
 * and it returns full statistics in the same response.
 */
export async function getTrendingFeed(options: FeedOptions = {}): Promise<CacheResult<Page<AppVideo>>> {
  const regionCode = options.regionCode ?? serverEnv.youtube.regionCode;
  const maxResults = clamp(options.maxResults ?? 24, 1, 50);
  const categoryId = options.categoryId ?? null;

  const key = stableKey('feed:trending', {
    regionCode,
    categoryId,
    maxResults,
    pageToken: options.pageToken ?? '',
  });

  return cached({
    key,
    ttlSeconds: TTL.trending,
    loader: async () => {
      const response = await callYouTube<YouTubeListResponse<YouTubeVideoItem>>('videos', {
        operation: 'videos',
        params: {
          part: 'snippet,contentDetails,statistics',
          chart: 'mostPopular',
          regionCode,
          videoCategoryId: categoryId ?? undefined,
          maxResults,
          pageToken: options.pageToken ?? undefined,
        },
      });

      const videos = (response.items ?? []).map(toAppVideo);
      // Not every category has a popular chart in every region — fall back once.
      if (videos.length === 0 && categoryId) {
        const fallback = await getCategoryFallback(categoryId, regionCode, maxResults, options.pageToken ?? null);
        if (fallback) return fallback;
      }

      await primeVideoCache(videos);
      const decorated = await decorateVideos(videos);
      return {
        items: decorated,
        nextPageToken: response.nextPageToken ?? null,
        totalResults: response.pageInfo?.totalResults ?? null,
      } satisfies Page<AppVideo>;
    },
  });
}

/**
 * Some categories (Education, Non-profits…) simply aren't charted. Rather than
 * showing an empty shelf we spend one 100-unit search — but only when the daily
 * budget can comfortably absorb it, and the result is cached for 30 minutes.
 */
async function getCategoryFallback(
  categoryId: string,
  regionCode: string,
  maxResults: number,
  pageToken: string | null,
): Promise<Page<AppVideo> | null> {
  if (!(await hasHeadroom('search'))) return null;

  const response = await callYouTube<YouTubeListResponse<YouTubeSearchItem>>('search', {
    operation: 'search',
    params: {
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      videoCategoryId: categoryId,
      order: 'viewCount',
      regionCode,
      relevanceLanguage: serverEnv.youtube.relevanceLanguage,
      publishedAfter: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
      maxResults,
      pageToken: pageToken ?? undefined,
    },
  });

  const ids = (response.items ?? [])
    .map((item) => toAppVideoFromSearch(item)?.id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;

  // 1 extra unit turns id-only search results into fully populated cards.
  const hydrated = await getVideosByIds(ids);
  return {
    items: await decorateVideos(hydrated),
    nextPageToken: response.nextPageToken ?? null,
    totalResults: response.pageInfo?.totalResults ?? null,
  };
}

/** Library / watch-later hydration: metadata for an explicit id list. */
export async function getVideosForIds(ids: readonly string[]): Promise<CacheResult<Page<AppVideo>>> {
  const trimmed = ids.filter(Boolean).slice(0, 50);
  if (trimmed.length === 0) {
    return { data: { items: [], nextPageToken: null, totalResults: 0 }, status: 'bypass', ageSeconds: 0 };
  }

  const videos = await getVideosByIds(trimmed);
  const decorated = await decorateVideos(videos);
  return {
    data: { items: decorated, nextPageToken: null, totalResults: decorated.length },
    // Per-video caching happens a layer down, so this envelope reports a miss.
    status: 'miss',
    ageSeconds: 0,
  };
}
