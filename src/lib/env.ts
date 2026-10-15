/**
 * Centralised, typed environment access.
 *
 * `serverEnv` must only ever be imported from server code (API routes, server
 * components, server-only libs). The YouTube API key never crosses the wire.
 */

function readInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

export type CacheDriver = 'memory' | 'upstash' | 'vercel-kv';

function readCacheDriver(): CacheDriver {
  const raw = (process.env.CACHE_DRIVER ?? 'memory').toLowerCase();
  if (raw === 'upstash' || raw === 'vercel-kv' || raw === 'memory') return raw;
  return 'memory';
}

/** Upstash and Vercel KV share the same REST contract, so one adapter covers both. */
function readRedisRest(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

export const serverEnv = {
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY?.trim() ?? '',
    regionCode: (process.env.YOUTUBE_REGION_CODE ?? 'US').trim().toUpperCase(),
    relevanceLanguage: (process.env.YOUTUBE_RELEVANCE_LANGUAGE ?? 'en').trim(),
    dailyQuotaBudget: readInt(process.env.YOUTUBE_DAILY_QUOTA_BUDGET, 9000),
    maxUnitsPerRequest: readInt(process.env.YOUTUBE_MAX_UNITS_PER_REQUEST, 110),
    allowSearchForRelated: readBool(process.env.ALLOW_SEARCH_FOR_RELATED, true),
  },
  cache: {
    driver: readCacheDriver(),
    memoryMaxEntries: readInt(process.env.CACHE_MEMORY_MAX_ENTRIES, 500),
    redis: readRedisRest(),
    ttl: {
      search: readInt(process.env.CACHE_TTL_SEARCH, 1800),
      trending: readInt(process.env.CACHE_TTL_TRENDING, 900),
      video: readInt(process.env.CACHE_TTL_VIDEO, 1800),
      channel: readInt(process.env.CACHE_TTL_CHANNEL, 3600),
      static: readInt(process.env.CACHE_TTL_STATIC, 86400),
    },
    staleGrace: readInt(process.env.CACHE_STALE_GRACE, 86400),
  },
} as const;

/** Safe to reference from client components — these are inlined at build time. */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? 'Velvet',
} as const;

/** True when the app has enough configuration to talk to YouTube. */
export const isYouTubeConfigured = serverEnv.youtube.apiKey.length > 0;
