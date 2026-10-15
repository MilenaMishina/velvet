/* ------------------------------------------------------------------------- *
 * Raw YouTube Data API v3 shapes (only the fields we actually request).
 * Everything optional is genuinely optional in the API responses.
 * ------------------------------------------------------------------------- */

export interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface YouTubeThumbnails {
  default?: YouTubeThumbnail;
  medium?: YouTubeThumbnail;
  high?: YouTubeThumbnail;
  standard?: YouTubeThumbnail;
  maxres?: YouTubeThumbnail;
}

export interface YouTubeListResponse<T> {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo?: { totalResults?: number; resultsPerPage?: number };
  items?: T[];
}

export interface YouTubeSearchItem {
  id: { kind: string; videoId?: string; channelId?: string; playlistId?: string };
  snippet?: {
    publishedAt?: string;
    channelId?: string;
    title?: string;
    description?: string;
    thumbnails?: YouTubeThumbnails;
    channelTitle?: string;
    liveBroadcastContent?: string;
  };
}

export interface YouTubeVideoItem {
  id: string;
  snippet?: {
    publishedAt?: string;
    channelId?: string;
    title?: string;
    description?: string;
    thumbnails?: YouTubeThumbnails;
    channelTitle?: string;
    tags?: string[];
    categoryId?: string;
    liveBroadcastContent?: string;
    defaultAudioLanguage?: string;
  };
  contentDetails?: {
    duration?: string;
    definition?: string;
    caption?: string;
    projection?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  status?: { embeddable?: boolean; privacyStatus?: string };
}

export interface YouTubeChannelItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    thumbnails?: YouTubeThumbnails;
    country?: string;
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  brandingSettings?: {
    channel?: { title?: string; description?: string; keywords?: string };
    image?: { bannerExternalUrl?: string };
  };
}

export interface YouTubePlaylistItem {
  id: string;
  snippet?: {
    publishedAt?: string;
    channelId?: string;
    title?: string;
    description?: string;
    thumbnails?: YouTubeThumbnails;
    channelTitle?: string;
    playlistId?: string;
    position?: number;
    resourceId?: { kind?: string; videoId?: string };
    videoOwnerChannelId?: string;
    videoOwnerChannelTitle?: string;
  };
  contentDetails?: { videoId?: string; videoPublishedAt?: string };
}

export interface YouTubePlaylistResource {
  id: string;
  snippet?: {
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    title?: string;
    description?: string;
    thumbnails?: YouTubeThumbnails;
  };
  contentDetails?: { itemCount?: number };
}

export interface YouTubeVideoCategoryItem {
  id: string;
  snippet?: { title?: string; assignable?: boolean; channelId?: string };
}

/** Shape of the error body Google returns (used to detect quota exhaustion). */
export interface YouTubeErrorBody {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ domain?: string; reason?: string; message?: string }>;
  };
}
