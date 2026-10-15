import 'server-only';

import { getCacheStore, namespaced } from '@/lib/cache/store';
import { serverEnv } from '@/lib/env';
import { chunk } from '@/lib/utils';
import { callYouTube } from '@/lib/youtube/client';
import { isQuotaError } from '@/lib/youtube/errors';
import type { AppVideo } from '@/lib/youtube/models';
import { toAppVideo, withChannelAvatars } from '@/lib/youtube/transform';
import type { YouTubeChannelItem, YouTubeListResponse, YouTubeVideoItem } from '@/lib/youtube/types';

/** YouTube caps `id` batches at 50 for every list endpoint. */
export const MAX_IDS_PER_CALL = 50;

export const TTL = serverEnv.cache.ttl;

interface BatchLoad<T> {
  fresh: Map<string, T>;
  stale: Map<string, T>;
  missing: string[];
}

/** Split requested ids into cache hits, usable stale copies, and true misses. */
async function partition<T>(prefix: string, ids: readonly string[]): Promise<BatchLoad<T>> {
  const store = getCacheStore();
  const fresh = new Map<string, T>();
  const stale = new Map<string, T>();
  const missing: string[] = [];
  const now = Date.now();

  await Promise.all(
    ids.map(async (id) => {
      const entry = await store.get<T>(namespaced(`${prefix}:${id}`));
      if (!entry) {
        missing.push(id);
      } else if (entry.expiresAt > now) {
        fresh.set(id, entry.data);
      } else {
        stale.set(id, entry.data);
        missing.push(id);
      }
    }),
  );

  return { fresh, stale, missing };
}

async function writeCache<T>(prefix: string, id: string, data: T, ttlSeconds: number): Promise<void> {
  const cache = getCacheStore();
  await cache.set(
    namespaced(`${prefix}:${id}`),
    { data, storedAt: Date.now(), expiresAt: Date.now() + ttlSeconds * 1000 },
    ttlSeconds + serverEnv.cache.staleGrace,
  );
}

/**
 * Per-video read-through cache.
 *
 * Caching individual videos (rather than whole result pages) is what keeps the
 * app inside quota: a trending video that also shows up in search, a channel
 * page and a "more like this" rail is fetched once and reused everywhere.
 * `videos.list` costs 1 unit for up to 50 ids, so misses are cheap too.
 */
export async function getVideoMap(ids: readonly string[]): Promise<Map<string, AppVideo>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const { fresh, stale, missing } = await partition<AppVideo>('video', unique);
  const result = new Map(fresh);

  for (const group of chunk(missing, MAX_IDS_PER_CALL)) {
    try {
      const response = await callYouTube<YouTubeListResponse<YouTubeVideoItem>>('videos', {
        operation: 'videos',
        params: {
          part: 'snippet,contentDetails,statistics',
          id: group.join(','),
          maxResults: MAX_IDS_PER_CALL,
        },
      });
      for (const item of response.items ?? []) {
        const video = toAppVideo(item);
        result.set(video.id, video);
        void writeCache('video', video.id, video, TTL.video).catch(() => undefined);
      }
    } catch (error) {
      const recoverable = group.filter((id) => stale.has(id));
      const recover = () => {
        for (const id of recoverable) {
          const cachedVideo = stale.get(id);
          if (cachedVideo) result.set(id, cachedVideo);
        }
      };
      // Quota exhaustion is expected and survivable: serve the stale copies.
      if (isQuotaError(error)) {
        recover();
        continue;
      }
      // Anything else only gets swallowed if we can still show something useful.
      if (recoverable.length === 0) throw error;
      console.warn('[youtube] video batch failed, serving stale:', (error as Error).message);
      recover();
    }
  }

  return result;
}

/** Ordered hydration: returns videos in the requested id order, skipping dead ids. */
export async function getVideosByIds(ids: readonly string[]): Promise<AppVideo[]> {
  const map = await getVideoMap(ids);
  return ids.map((id) => map.get(id)).filter((video): video is AppVideo => Boolean(video));
}

/** Channel avatars, cached for a day — they change far less often than videos. */
export async function getChannelAvatars(channelIds: readonly string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(channelIds.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const { fresh, stale, missing } = await partition<string | null>('avatar', unique);
  const avatars = new Map(fresh);
  for (const [id, url] of stale) avatars.set(id, url);

  for (const group of chunk(missing, MAX_IDS_PER_CALL)) {
    try {
      const response = await callYouTube<YouTubeListResponse<YouTubeChannelItem>>('channels', {
        operation: 'channels',
        params: { part: 'snippet', id: group.join(','), maxResults: MAX_IDS_PER_CALL },
      });
      for (const item of response.items ?? []) {
        const url =
          item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null;
        avatars.set(item.id, url);
        void writeCache('avatar', item.id, url, TTL.static).catch(() => undefined);
      }
    } catch (error) {
      // Avatars are decoration: never let them break a feed.
      if (!isQuotaError(error)) console.warn('[youtube] avatar batch failed:', (error as Error).message);
    }
  }

  return avatars;
}

/** Attach avatars to a list of videos in one extra 1-unit call (or zero, cached). */
export async function decorateVideos(videos: AppVideo[]): Promise<AppVideo[]> {
  if (videos.length === 0) return videos;
  const avatars = await getChannelAvatars(videos.map((video) => video.channel.id));
  return withChannelAvatars(videos, avatars);
}

/**
 * Seed the per-video cache from a feed response. Trending and channel-upload
 * payloads already contain full video resources, so watch pages opened from a
 * feed cost zero additional quota.
 */
export async function primeVideoCache(videos: readonly AppVideo[]): Promise<void> {
  await Promise.all(videos.map((video) => writeCache('video', video.id, video, TTL.video).catch(() => undefined)));
}
