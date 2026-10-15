import { parseIsoDuration, toTeaser } from '@/lib/format';
import type { AppChannel, AppImage, AppPlaylist, AppVideo } from '@/lib/youtube/models';
import type {
  YouTubeChannelItem,
  YouTubePlaylistItem,
  YouTubePlaylistResource,
  YouTubeSearchItem,
  YouTubeThumbnails,
  YouTubeVideoItem,
} from '@/lib/youtube/types';

/** Thumbnails come from Google's CDN and are rendered as-is — never copied. */
const THUMBNAIL_PREFERENCE = ['maxres', 'standard', 'high', 'medium', 'default'] as const;

export function pickThumbnail(thumbnails: YouTubeThumbnails | undefined, videoId?: string): AppImage {
  for (const size of THUMBNAIL_PREFERENCE) {
    const candidate = thumbnails?.[size];
    if (candidate?.url) {
      return { url: candidate.url, width: candidate.width ?? 1280, height: candidate.height ?? 720 };
    }
  }
  // Deterministic fallback so a missing snippet never yields a broken card.
  return videoId
    ? { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 }
    : { url: '', width: 1280, height: 720 };
}

function pickAvatar(thumbnails: YouTubeThumbnails | undefined): string | null {
  return thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null;
}

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;
const channelUrl = (channelId: string) => `https://www.youtube.com/channel/${channelId}`;

/** `videos.list` item → domain model. This is the richest source (has statistics). */
export function toAppVideo(item: YouTubeVideoItem): AppVideo {
  const snippet = item.snippet;
  const live = snippet?.liveBroadcastContent;
  const definition = item.contentDetails?.definition;

  return {
    id: item.id,
    title: snippet?.title ?? 'Untitled video',
    description: snippet?.description ?? '',
    teaser: toTeaser(snippet?.description),
    publishedAt: snippet?.publishedAt ?? '',
    thumbnail: pickThumbnail(snippet?.thumbnails, item.id),
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    isLive: live === 'live',
    isUpcoming: live === 'upcoming',
    viewCount: toNumber(item.statistics?.viewCount),
    likeCount: toNumber(item.statistics?.likeCount),
    commentCount: toNumber(item.statistics?.commentCount),
    channel: {
      id: snippet?.channelId ?? '',
      title: snippet?.channelTitle ?? 'Unknown channel',
      avatarUrl: null,
    },
    tags: snippet?.tags ?? [],
    categoryId: snippet?.categoryId ?? null,
    definition: definition === 'hd' || definition === 'sd' ? definition : null,
    hasCaptions: item.contentDetails?.caption === 'true',
    watchUrl: watchUrl(item.id),
  };
}

/**
 * `search.list` item → domain model. Statistics are absent here, which is why
 * the service layer always follows up with a 1-unit `videos.list` hydration.
 */
export function toAppVideoFromSearch(item: YouTubeSearchItem): AppVideo | null {
  const id = item.id.videoId;
  if (!id) return null;
  const snippet = item.snippet;
  return {
    id,
    title: snippet?.title ?? 'Untitled video',
    description: snippet?.description ?? '',
    teaser: toTeaser(snippet?.description),
    publishedAt: snippet?.publishedAt ?? '',
    thumbnail: pickThumbnail(snippet?.thumbnails, id),
    durationSeconds: null,
    isLive: snippet?.liveBroadcastContent === 'live',
    isUpcoming: snippet?.liveBroadcastContent === 'upcoming',
    viewCount: null,
    likeCount: null,
    commentCount: null,
    channel: { id: snippet?.channelId ?? '', title: snippet?.channelTitle ?? 'Unknown channel', avatarUrl: null },
    tags: [],
    categoryId: null,
    definition: null,
    hasCaptions: false,
    watchUrl: watchUrl(id),
  };
}

/** Extract the video id from a playlist item (uploads playlists, curated lists). */
export function playlistItemVideoId(item: YouTubePlaylistItem): string | null {
  return item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? null;
}

export function toAppChannel(item: YouTubeChannelItem): AppChannel {
  const snippet = item.snippet;
  const keywords = item.brandingSettings?.channel?.keywords ?? '';
  return {
    id: item.id,
    title: snippet?.title ?? item.brandingSettings?.channel?.title ?? 'Unknown channel',
    handle: snippet?.customUrl ?? null,
    description: snippet?.description ?? item.brandingSettings?.channel?.description ?? '',
    avatarUrl: pickAvatar(snippet?.thumbnails),
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl ?? null,
    subscriberCount: toNumber(item.statistics?.subscriberCount),
    subscriberCountHidden: item.statistics?.hiddenSubscriberCount === true,
    videoCount: toNumber(item.statistics?.videoCount),
    viewCount: toNumber(item.statistics?.viewCount),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    publishedAt: snippet?.publishedAt ?? null,
    // Keywords arrive as a quoted, space-separated blob: `"lo fi" beats study`.
    keywords: (keywords.match(/"[^"]+"|\S+/g) ?? []).map((word) => word.replace(/"/g, '')).slice(0, 12),
    channelUrl: channelUrl(item.id),
  };
}

export function toAppPlaylist(item: YouTubePlaylistResource): AppPlaylist {
  const snippet = item.snippet;
  return {
    id: item.id,
    title: snippet?.title ?? 'Untitled playlist',
    description: snippet?.description ?? '',
    thumbnail: snippet?.thumbnails ? pickThumbnail(snippet.thumbnails) : null,
    itemCount: item.contentDetails?.itemCount ?? null,
    channel: { id: snippet?.channelId ?? '', title: snippet?.channelTitle ?? '' },
    publishedAt: snippet?.publishedAt ?? null,
    playlistUrl: `https://www.youtube.com/playlist?list=${item.id}`,
  };
}

/** Merge channel avatars into a video list (avatars need a separate 1-unit call). */
export function withChannelAvatars(videos: AppVideo[], avatars: Map<string, string | null>): AppVideo[] {
  return videos.map((video) =>
    avatars.has(video.channel.id)
      ? { ...video, channel: { ...video.channel, avatarUrl: avatars.get(video.channel.id) ?? null } }
      : video,
  );
}
