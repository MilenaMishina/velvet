import type { NextRequest } from 'next/server';

import { badRequest, emptyPage, serveEnvelope } from '@/lib/api/envelope';
import { parseCount, parsePageToken, parsePlaylistId } from '@/lib/api/params';
import { serverEnv } from '@/lib/env';
import type { AppVideo } from '@/lib/youtube/models';
import { getPlaylistVideos } from '@/lib/youtube/service';

/** GET /api/youtube/playlist/[id]/items?pageToken=… — one page of playlist videos. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const playlistId = parsePlaylistId(params.id);
  if (!playlistId) return badRequest('A valid playlist id is required.');

  const query = request.nextUrl.searchParams;
  return serveEnvelope(
    () =>
      getPlaylistVideos(playlistId, {
        pageToken: parsePageToken(query.get('pageToken')),
        maxResults: parseCount(query.get('max'), 24),
      }),
    { ttlSeconds: serverEnv.cache.ttl.channel, fallback: emptyPage<AppVideo>() },
  );
}
