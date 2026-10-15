/* ------------------------------------------------------------------------- *
 * Application domain models.
 *
 * We deliberately keep these *metadata only* — video IDs, titles, thumbnail
 * URLs, counts. No stream URLs are ever derived, stored or proxied: playback is
 * handled exclusively by YouTube's official IFrame player.
 * ------------------------------------------------------------------------- */

export interface AppImage {
  url: string;
  width: number;
  height: number;
}

export interface AppVideoChannelRef {
  id: string;
  title: string;
  avatarUrl: string | null;
}

export interface AppVideo {
  id: string;
  title: string;
  description: string;
  /** Single-line teaser used on cards. */
  teaser: string;
  publishedAt: string;
  thumbnail: AppImage;
  durationSeconds: number | null;
  isLive: boolean;
  isUpcoming: boolean;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  channel: AppVideoChannelRef;
  tags: string[];
  categoryId: string | null;
  definition: 'hd' | 'sd' | null;
  hasCaptions: boolean;
  /** Canonical YouTube URL — always shown so creators keep their attribution. */
  watchUrl: string;
}

export interface AppChannel {
  id: string;
  title: string;
  handle: string | null;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number | null;
  subscriberCountHidden: boolean;
  videoCount: number | null;
  viewCount: number | null;
  uploadsPlaylistId: string | null;
  publishedAt: string | null;
  keywords: string[];
  channelUrl: string;
}

export interface AppPlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: AppImage | null;
  itemCount: number | null;
  channel: { id: string; title: string };
  publishedAt: string | null;
  playlistUrl: string;
}

export interface AppCategory {
  id: string;
  title: string;
  /** Curated slug used in our own URLs, e.g. "music". */
  slug: string;
  icon: string;
}

export interface Page<T> {
  items: T[];
  nextPageToken: string | null;
  totalResults: number | null;
}

export type DegradedReason = 'quota-exceeded' | 'quota-guard' | 'upstream-error' | 'not-configured';

export interface QuotaSnapshot {
  spent: number;
  budget: number;
  remaining: number;
  /** ISO timestamp of the next midnight Pacific reset. */
  resetsAt: string;
}

export interface ResponseMeta {
  cache: 'miss' | 'fresh' | 'stale' | 'bypass';
  ageSeconds: number;
  quota: QuotaSnapshot;
  degraded?: { reason: DegradedReason; message: string };
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

/* ---------------------------- query parameters --------------------------- */

export const SEARCH_ORDERS = ['relevance', 'date', 'viewCount', 'rating', 'title'] as const;
export type SearchOrder = (typeof SEARCH_ORDERS)[number];

export const DURATION_FILTERS = ['any', 'short', 'medium', 'long'] as const;
export type DurationFilter = (typeof DURATION_FILTERS)[number];

export const UPLOAD_WINDOWS = ['any', 'hour', 'today', 'week', 'month', 'year'] as const;
export type UploadWindow = (typeof UPLOAD_WINDOWS)[number];

export interface SearchQuery {
  q: string;
  order: SearchOrder;
  duration: DurationFilter;
  uploaded: UploadWindow;
  pageToken?: string;
  channelId?: string;
}
