import 'server-only';

import { cached, type CacheResult } from '@/lib/cache';
import { serverEnv } from '@/lib/env';
import { stableKey } from '@/lib/utils';
import { callYouTube } from '@/lib/youtube/client';
import { YouTubeApiError } from '@/lib/youtube/errors';
import type { AppVideo, DurationFilter, Page, SearchOrder, SearchQuery, UploadWindow } from '@/lib/youtube/models';
import type { YouTubeListResponse, YouTubeSearchItem } from '@/lib/youtube/types';
import { decorateVideos, getVideosByIds, TTL } from '@/lib/youtube/service/shared';

/** One page of search results. 25 keeps payloads light while filling a 4-col grid. */
export const SEARCH_PAGE_SIZE = 25;

const WINDOW_MS: Record<Exclude<UploadWindow, 'any'>, number> = {  hour: 60 * 60 * 1000,
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

function publishedAfter(window: UploadWindow): string | undefined {
  if (window === 'any') return undefined;
  // Rounded to the hour so equivalent searches share one cache entry.
  const now = Date.now();
  const rounded = now - (now % (60 * 60 * 1000));
  return new Date(rounded - WINDOW_MS[window]).toISOString();
}

function videoDuration(filter: DurationFilter): string | undefined {
  return filter === 'any' ? undefined : filter;
}

/**
 * Full-text search.
 *
 * `search.list` is the only 100-unit call in the app, so it is:
 *  - cached for 30 minutes (per query + filters + page)
 *  - single-flighted, so concurrent identical searches spend one call
 *  - followed by a 1-unit `videos.list` hydration, because search results carry
 *    no duration or statistics of their own
 */
export async function searchVideos(query: SearchQuery): Promise<CacheResult<Page<AppVideo>>> {
  const q = query.q.trim();
  if (!q && !query.channelId) {
    throw new YouTubeApiError('INVALID_REQUEST', 'A search needs a query or a channel id.');
  }

  const order: SearchOrder = query.order;
  const key = stableKey('feed:search', {
    q: q.toLowerCase(),
    order,
    duration: query.duration,
    uploaded: query.uploaded,
    channelId: query.channelId ?? '',
    pageToken: query.pageToken ?? '',
    regionCode: serverEnv.youtube.regionCode,
  });

  return cached({
    key,
    ttlSeconds: TTL.search,
    loader: async () => {
      const response = await callYouTube<YouTubeListResponse<YouTubeSearchItem>>('search', {
        operation: 'search',
        params: {
          part: 'snippet',
          type: 'video',
          // Only surface videos that are actually playable in our embed.
          videoEmbeddable: 'true',
          videoSyndicated: 'true',
          safeSearch: 'moderate',
          q: q || undefined,
          channelId: query.channelId,
          order,
          videoDuration: videoDuration(query.duration),
          publishedAfter: publishedAfter(query.uploaded),
          regionCode: serverEnv.youtube.regionCode,
          relevanceLanguage: serverEnv.youtube.relevanceLanguage,
          maxResults: SEARCH_PAGE_SIZE,
          pageToken: query.pageToken ?? undefined,
        },
      });

      const ids = (response.items ?? [])
        .map((item) => item.id.videoId)
        .filter((id): id is string => Boolean(id));

      const hydrated = await getVideosByIds(ids);
      const decorated = await decorateVideos(hydrated);

      return {
        items: decorated,
        nextPageToken: response.nextPageToken ?? null,
        totalResults: response.pageInfo?.totalResults ?? null,
      } satisfies Page<AppVideo>;
    },
  });
}
