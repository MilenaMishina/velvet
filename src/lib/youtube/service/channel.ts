import 'server-only';

import { cached, type CacheResult } from '@/lib/cache';
import { clamp, stableKey } from '@/lib/utils';
import { callYouTube } from '@/lib/youtube/client';
import { YouTubeApiError } from '@/lib/youtube/errors';
import type { AppChannel, AppPlaylist, AppVideo, Page } from '@/lib/youtube/models';
import { playlistItemVideoId, toAppChannel, toAppPlaylist } from '@/lib/youtube/transform';
import type {
  YouTubeChannelItem,
  YouTubeListResponse,
  YouTubePlaylistItem,
  YouTubePlaylistResource,
} from '@/lib/youtube/types';
import { decorateVideos, getVideosByIds, TTL } from '@/lib/youtube/service/shared';

const CHANNEL_PARTS = 'snippet,statistics,contentDetails,brandingSettings';

/**
 * Channel metadata (1 unit). Accepts a channel id (`UC…`) or an `@handle`,
 * resolved with `forHandle` so we never pay for a 100-unit search.
 */
export async function getChannel(idOrHandle: string): Promise<CacheResult<AppChannel>> {
  const handle = idOrHandle.startsWith('@') ? idOrHandle : null;
  const key = stableKey('channel', { ref: idOrHandle.toLowerCase() });

  return cached({
    key,
    ttlSeconds: TTL.channel,
    loader: async () => {
      const response = await callYouTube<YouTubeListResponse<YouTubeChannelItem>>('channels', {
        operation: 'channels',
        params: {
          part: CHANNEL_PARTS,
          id: handle ? undefined : idOrHandle,
          forHandle: handle ?? undefined,
        },
      });
      const item = response.items?.[0];
      if (!item) throw new YouTubeApiError('NOT_FOUND', `No channel for "${idOrHandle}".`);
      return toAppChannel(item);
    },
  });
}

export interface PaginatedOptions {
  pageToken?: string | null;
  maxResults?: number;
}

/**
 * A channel's uploads. Every channel exposes an "uploads" playlist, so this is
 * two 1-unit calls (`playlistItems.list` + `videos.list`) instead of a search.
 */
export async function getChannelUploads(
  channelId: string,
  options: PaginatedOptions = {},
): Promise<CacheResult<Page<AppVideo>>> {
  const maxResults = clamp(options.maxResults ?? 24, 1, 50);
  const channel = await getChannel(channelId);
  const uploads = channel.data.uploadsPlaylistId;
  if (!uploads) {
    return { data: { items: [], nextPageToken: null, totalResults: 0 }, status: 'bypass', ageSeconds: 0 };
  }
  return getPlaylistVideos(uploads, { ...options, maxResults });
}

/** Playlist contents, hydrated into full video cards. */
export async function getPlaylistVideos(
  playlistId: string,
  options: PaginatedOptions = {},
): Promise<CacheResult<Page<AppVideo>>> {
  const maxResults = clamp(options.maxResults ?? 24, 1, 50);
  const key = stableKey('playlist:items', {
    playlistId,
    maxResults,
    pageToken: options.pageToken ?? '',
  });

  return cached({
    key,
    ttlSeconds: TTL.channel,
    loader: async () => {
      const response = await callYouTube<YouTubeListResponse<YouTubePlaylistItem>>('playlistItems', {
        operation: 'playlistItems',
        params: {
          part: 'snippet,contentDetails',
          playlistId,
          maxResults,
          pageToken: options.pageToken ?? undefined,
        },
      });

      const ids = (response.items ?? [])
        .map(playlistItemVideoId)
        .filter((id): id is string => Boolean(id));

      const videos = await getVideosByIds(ids);
      return {
        items: await decorateVideos(videos),
        nextPageToken: response.nextPageToken ?? null,
        totalResults: response.pageInfo?.totalResults ?? null,
      } satisfies Page<AppVideo>;
    },
  });
}

/** Playlists owned by a channel (1 unit). */
export async function getChannelPlaylists(
  channelId: string,
  options: PaginatedOptions = {},
): Promise<CacheResult<Page<AppPlaylist>>> {
  const maxResults = clamp(options.maxResults ?? 24, 1, 50);
  const key = stableKey('channel:playlists', { channelId, maxResults, pageToken: options.pageToken ?? '' });

  return cached({
    key,
    ttlSeconds: TTL.channel,
    loader: async () => {
      const response = await callYouTube<YouTubeListResponse<YouTubePlaylistResource>>('playlists', {
        operation: 'playlists',
        params: {
          part: 'snippet,contentDetails',
          channelId,
          maxResults,
          pageToken: options.pageToken ?? undefined,
        },
      });
      return {
        items: (response.items ?? []).map(toAppPlaylist),
        nextPageToken: response.nextPageToken ?? null,
        totalResults: response.pageInfo?.totalResults ?? null,
      } satisfies Page<AppPlaylist>;
    },
  });
}

/** Playlist metadata (1 unit). */
export async function getPlaylist(playlistId: string): Promise<CacheResult<AppPlaylist>> {
  return cached({
    key: stableKey('playlist', { playlistId }),
    ttlSeconds: TTL.channel,
    loader: async () => {
      const response = await callYouTube<YouTubeListResponse<YouTubePlaylistResource>>('playlists', {
        operation: 'playlists',
        params: { part: 'snippet,contentDetails', id: playlistId },
      });
      const item = response.items?.[0];
      if (!item) throw new YouTubeApiError('NOT_FOUND', `No playlist for "${playlistId}".`);
      return toAppPlaylist(item);
    },
  });
}
