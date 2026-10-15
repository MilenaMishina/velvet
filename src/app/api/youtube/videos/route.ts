import type { NextRequest } from 'next/server';

import { emptyPage, serveEnvelope } from '@/lib/api/envelope';
import { parseVideoIds } from '@/lib/api/params';
import { serverEnv } from '@/lib/env';
import type { AppVideo } from '@/lib/youtube/models';
import { getVideosForIds } from '@/lib/youtube/service';

/**
 * GET /api/youtube/videos?ids=abc,def
 *
 * Hydrates a caller-supplied id list — this is how the client library (Watch
 * Later / Favorites / History) turns locally stored ids into real cards without
 * ever persisting metadata itself. Up to 50 ids cost a single quota unit.
 */
export async function GET(request: NextRequest) {
  const ids = parseVideoIds(request.nextUrl.searchParams.get('ids'));

  return serveEnvelope(() => getVideosForIds(ids), {
    ttlSeconds: serverEnv.cache.ttl.video,
    fallback: emptyPage<AppVideo>(),
  });
}
