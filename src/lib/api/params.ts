import {
  DURATION_FILTERS,
  type DurationFilter,
  SEARCH_ORDERS,
  type SearchOrder,
  UPLOAD_WINDOWS,
  type UploadWindow,
} from '@/lib/youtube/models';

/**
 * Request-parameter parsing shared by API routes and page search params.
 *
 * Anything arriving from a URL is untrusted: every value is validated against a
 * known set and falls back to a safe default rather than reaching YouTube raw.
 */

const YOUTUBE_VIDEO_ID = /^[\w-]{11}$/;
const YOUTUBE_CHANNEL_ID = /^UC[\w-]{22}$/;
const YOUTUBE_PLAYLIST_ID = /^[\w-]{2,64}$/;
/** Page tokens are opaque base64-ish strings; reject anything that isn't. */
const PAGE_TOKEN = /^[\w\-=.%]{1,256}$/;

function oneOf<T extends string>(allowed: readonly T[], raw: string | null | undefined, fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

export const parseOrder = (raw: string | null | undefined): SearchOrder =>
  oneOf(SEARCH_ORDERS, raw, 'relevance');

export const parseDuration = (raw: string | null | undefined): DurationFilter =>
  oneOf(DURATION_FILTERS, raw, 'any');

export const parseUploadWindow = (raw: string | null | undefined): UploadWindow =>
  oneOf(UPLOAD_WINDOWS, raw, 'any');

export function parsePageToken(raw: string | null | undefined): string | null {
  return raw && PAGE_TOKEN.test(raw) ? raw : null;
}

export function parseVideoId(raw: string | null | undefined): string | null {
  return raw && YOUTUBE_VIDEO_ID.test(raw) ? raw : null;
}

export function parseChannelRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = decodeURIComponent(raw);
  if (YOUTUBE_CHANNEL_ID.test(value)) return value;
  // Handles arrive as "@creator" (or "%40creator" from a URL segment).
  if (/^@[\w.\-]{3,60}$/.test(value)) return value;
  return null;
}

export function parsePlaylistId(raw: string | null | undefined): string | null {
  return raw && YOUTUBE_PLAYLIST_ID.test(raw) ? raw : null;
}

/** Comma-separated video ids, de-duplicated and capped at one API batch. */
export function parseVideoIds(raw: string | null | undefined, limit = 50): string[] {
  if (!raw) return [];
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => YOUTUBE_VIDEO_ID.test(id));
  return Array.from(new Set(ids)).slice(0, limit);
}

export function parseSearchTerm(raw: string | null | undefined, maxLength = 120): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function parseCount(raw: string | null | undefined, fallback: number, min = 1, max = 50): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), min), max);
}
