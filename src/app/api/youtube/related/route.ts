import type { NextRequest } from 'next/server';

import { badRequest, emptyPage, serveEnvelope } from '@/lib/api/envelope';
import { parseVideoId } from '@/lib/api/params';
import { serverEnv } from '@/lib/env';
import type { AppVideo } from '@/lib/youtube/models';
import { getRelatedVideos } from '@/lib/youtube/service';

/**
 * GET /api/youtube/related?videoId=…
 *
 * "More like this". `relatedToVideoId` was removed from the Data API in 2023, so
 * this is rebuilt from channel uploads, category charts and (only when the budget
 * allows) a tag-similarity search — see `service/watch.ts`.
 */
export async function GET(request: NextRequest) {
  const videoId = parseVideoId(request.nextUrl.searchParams.get('videoId'));
  if (!videoId) return badRequest('A valid 11-character "videoId" is required.');

  return serveEnvelope(() => getRelatedVideos(videoId), {
    ttlSeconds: serverEnv.cache.ttl.search,
    fallback: emptyPage<AppVideo>(),
  });
}
