import type { NextRequest } from 'next/server';

import { badRequest, emptyPage, serveEnvelope } from '@/lib/api/envelope';
import {
  parseChannelRef,
  parseDuration,
  parseOrder,
  parsePageToken,
  parseSearchTerm,
  parseUploadWindow,
} from '@/lib/api/params';
import { serverEnv } from '@/lib/env';
import type { AppVideo } from '@/lib/youtube/models';
import { searchVideos } from '@/lib/youtube/service';

/**
 * GET /api/youtube/search?q=…&order=…&duration=…&uploaded=…&pageToken=…
 *
 * The only 100-unit endpoint in the app. It is cached for 30 minutes per unique
 * query + filter + page combination, and single-flighted so a burst of identical
 * searches costs one call.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = parseSearchTerm(params.get('q'));
  const channelId = parseChannelRef(params.get('channelId'));

  if (!q && !channelId) {
    return badRequest('Provide a "q" search term or a "channelId".');
  }

  return serveEnvelope(
    () =>
      searchVideos({
        q,
        order: parseOrder(params.get('order')),
        duration: parseDuration(params.get('duration')),
        uploaded: parseUploadWindow(params.get('uploaded')),
        channelId: channelId ?? undefined,
        pageToken: parsePageToken(params.get('pageToken')) ?? undefined,
      }),
    { ttlSeconds: serverEnv.cache.ttl.search, fallback: emptyPage<AppVideo>() },
  );
}
