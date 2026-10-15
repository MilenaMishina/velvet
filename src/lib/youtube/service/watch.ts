import 'server-only';

import { cached, type CacheResult } from '@/lib/cache';
import { serverEnv } from '@/lib/env';
import { stableKey, uniqueBy } from '@/lib/utils';
import { callYouTube } from '@/lib/youtube/client';
import { isQuotaError, YouTubeApiError } from '@/lib/youtube/errors';
import type { AppChannel, AppVideo, Page } from '@/lib/youtube/models';
import { hasHeadroom } from '@/lib/youtube/quota';
import { toAppVideo } from '@/lib/youtube/transform';
import type { YouTubeListResponse, YouTubeSearchItem, YouTubeVideoItem } from '@/lib/youtube/types';
import { getChannel, getPlaylistVideos } from '@/lib/youtube/service/channel';
import { decorateVideos, getVideoMap, primeVideoCache, TTL } from '@/lib/youtube/service/shared';

export interface WatchData {
  video: AppVideo;
  channel: AppChannel | null;
}

/** Watch page payload: the video plus its channel (2 units cold, 0 when cached). */
export async function getWatchData(videoId: string): Promise<CacheResult<WatchData>> {
  return cached({
    key: stableKey('watch', { videoId }),
    ttlSeconds: TTL.video,
    loader: async () => {
      const map = await getVideoMap([videoId]);
      const video = map.get(videoId);
      if (!video) {
        throw new YouTubeApiError('NOT_FOUND', `Video "${videoId}" is unavailable, private, or removed.`);
      }
      const [decorated] = await decorateVideos([video]);
      const channel = video.channel.id
        ? await getChannel(video.channel.id)
            .then((result) => result.data)
            .catch(() => null)
        : null;
      return { video: decorated ?? video, channel };
    },
  });
}

const RELATED_TARGET = 24;
const MAX_SAME_CHANNEL = 8;

/**
 * "More like this".
 *
 * YouTube retired `search.list?relatedToVideoId` in 2023, so relatedness is
 * rebuilt from cheap signals, in ascending cost order:
 *
 *   1. the creator's other uploads   — 2 units (playlistItems + videos)
 *   2. the same category's chart     — 1 unit  (videos.list?chart=mostPopular)
 *   3. tag similarity search         — 100 units, only if 1+2 came up short,
 *                                      the budget has room, and it's enabled
 *
 * Candidates are then scored on channel match, tag overlap, category, recency
 * and popularity, and capped so one creator can't swamp the rail.
 */
export async function getRelatedVideos(videoId: string): Promise<CacheResult<Page<AppVideo>>> {
  return cached({
    key: stableKey('related', { videoId }),
    ttlSeconds: TTL.search,
    loader: async () => {
      const seedMap = await getVideoMap([videoId]);
      const seed = seedMap.get(videoId);
      if (!seed) throw new YouTubeApiError('NOT_FOUND', `Video "${videoId}" is unavailable.`);

      const candidates: AppVideo[] = [];
      const sources = new Map<string, 'channel' | 'category' | 'search'>();

      const collect = (videos: AppVideo[], source: 'channel' | 'category' | 'search') => {
        for (const video of videos) {
          if (video.id === seed.id) continue;
          if (!sources.has(video.id)) sources.set(video.id, source);
          candidates.push(video);
        }
      };

      collect(await fromChannel(seed), 'channel');
      collect(await fromCategory(seed), 'category');

      if (candidates.length < 12) {
        collect(await fromTagSearch(seed), 'search');
      }

      const unique = uniqueBy(candidates, (video) => video.id).filter(isPlayable);
      const ranked = unique
        .map((video) => ({ video, score: scoreCandidate(video, seed, sources.get(video.id) ?? 'category') }))
        .sort((a, b) => b.score - a.score);

      const picked: AppVideo[] = [];
      let sameChannel = 0;
      for (const { video } of ranked) {
        if (video.channel.id === seed.channel.id) {
          if (sameChannel >= MAX_SAME_CHANNEL) continue;
          sameChannel += 1;
        }
        picked.push(video);
        if (picked.length >= RELATED_TARGET) break;
      }

      return {
        items: await decorateVideos(picked),
        nextPageToken: null,
        totalResults: picked.length,
      } satisfies Page<AppVideo>;
    },
  });
}

/** A video without a duration and not live is almost always unavailable. */
function isPlayable(video: AppVideo): boolean {
  return video.isLive || video.isUpcoming || video.durationSeconds !== null;
}

async function fromChannel(seed: AppVideo): Promise<AppVideo[]> {
  if (!seed.channel.id) return [];
  try {
    const channel = await getChannel(seed.channel.id);
    const uploads = channel.data.uploadsPlaylistId;
    if (!uploads) return [];
    const result = await getPlaylistVideos(uploads, { maxResults: 20 });
    return result.data.items;
  } catch (error) {
    if (!isQuotaError(error)) console.warn('[related] channel signal failed:', (error as Error).message);
    return [];
  }
}

async function fromCategory(seed: AppVideo): Promise<AppVideo[]> {
  if (!seed.categoryId) return [];
  try {
    const response = await callYouTube<YouTubeListResponse<YouTubeVideoItem>>('videos', {
      operation: 'videos',
      params: {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        videoCategoryId: seed.categoryId,
        regionCode: serverEnv.youtube.regionCode,
        maxResults: 25,
      },
    });
    const videos = (response.items ?? []).map(toAppVideo);
    await primeVideoCache(videos);
    return videos;
  } catch (error) {
    if (!isQuotaError(error)) console.warn('[related] category signal failed:', (error as Error).message);
    return [];
  }
}

/** The only expensive signal — gated behind config *and* remaining budget. */
async function fromTagSearch(seed: AppVideo): Promise<AppVideo[]> {
  if (!serverEnv.youtube.allowSearchForRelated) return [];
  // Keep a healthy reserve: never let related rails eat the whole day's budget.
  if (!(await hasHeadroom('search', 3))) return [];

  const terms = [...seed.tags.slice(0, 4), ...seed.title.split(/\s+/).slice(0, 4)]
    .map((term) => term.replace(/[^\p{L}\p{N}\s'-]/gu, '').trim())
    .filter((term) => term.length > 2);
  const q = Array.from(new Set(terms)).slice(0, 6).join(' ');
  if (!q) return [];

  try {
    const response = await callYouTube<YouTubeListResponse<YouTubeSearchItem>>('search', {
      operation: 'search',
      params: {
        part: 'snippet',
        type: 'video',
        videoEmbeddable: 'true',
        videoSyndicated: 'true',
        q,
        videoCategoryId: seed.categoryId ?? undefined,
        maxResults: 20,
        regionCode: serverEnv.youtube.regionCode,
        relevanceLanguage: serverEnv.youtube.relevanceLanguage,
      },
    });
    const ids = (response.items ?? [])
      .map((item) => item.id.videoId)
      .filter((id): id is string => Boolean(id));
    const map = await getVideoMap(ids);
    return ids.map((id) => map.get(id)).filter((video): video is AppVideo => Boolean(video));
  } catch (error) {
    if (!isQuotaError(error)) console.warn('[related] tag search failed:', (error as Error).message);
    return [];
  }
}

function normaliseTag(tag: string): string {
  return tag.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function scoreCandidate(video: AppVideo, seed: AppVideo, source: 'channel' | 'category' | 'search'): number {
  let score = 0;

  if (video.channel.id && video.channel.id === seed.channel.id) score += 45;
  if (video.categoryId && video.categoryId === seed.categoryId) score += 15;
  if (source === 'search') score += 8;

  const seedTags = new Set(seed.tags.map(normaliseTag).filter(Boolean));
  if (seedTags.size > 0) {
    const overlap = video.tags.map(normaliseTag).filter((tag) => seedTags.has(tag)).length;
    score += Math.min(overlap, 5) * 10;
  }

  // Popularity, log-scaled so a 10M-view video doesn't dominate outright.
  score += Math.log10(Math.max(video.viewCount ?? 1, 1)) * 3;

  const publishedAt = Date.parse(video.publishedAt);
  if (Number.isFinite(publishedAt)) {
    const ageDays = (Date.now() - publishedAt) / 86_400_000;
    score += Math.max(0, 12 - ageDays / 30);
  }

  if (video.isLive) score += 5;
  return score;
}
