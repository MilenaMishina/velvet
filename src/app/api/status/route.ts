import { NextResponse } from 'next/server';

import { isYouTubeConfigured, serverEnv } from '@/lib/env';
import { getCacheStore } from '@/lib/cache/store';
import { snapshot } from '@/lib/youtube/quota';

/**
 * GET /api/status — operational snapshot for the quota widget and uptime checks.
 *
 * Deliberately reveals no secrets: configuration is reported as a boolean, never
 * as a key, and the cache driver name carries no credentials.
 */
export async function GET() {
  const quota = await snapshot();

  return NextResponse.json(
    {
      ok: isYouTubeConfigured,
      configured: isYouTubeConfigured,
      cache: { driver: getCacheStore().name, ttl: serverEnv.cache.ttl },
      quota,
      region: serverEnv.youtube.regionCode,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
