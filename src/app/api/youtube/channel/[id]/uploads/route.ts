import type { NextRequest } from 'next/server';

import { badRequest, emptyPage, serveEnvelope } from '@/lib/api/envelope';
import { parseChannelRef, parseCount, parsePageToken } from '@/lib/api/params';
import { serverEnv } from '@/lib/env';
import type { AppVideo } from '@/lib/youtube/models';
import { getChannelUploads } from '@/lib/youtube/service';

/**
 * GET /api/youtube/channel/[id]/uploads?pageToken=…
 *
 * Paginates a channel's uploads playlist (2 units per page) instead of running a
 * channel-scoped search (100 units).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const channelId = parseChannelRef(params.id);
  if (!channelId) return badRequest('Expected a channel id ("UC…") or handle ("@name").');

  const query = request.nextUrl.searchParams;
  return serveEnvelope(
    () =>
      getChannelUploads(channelId, {
        pageToken: parsePageToken(query.get('pageToken')),
        maxResults: parseCount(query.get('max'), 24),
      }),
    { ttlSeconds: serverEnv.cache.ttl.channel, fallback: emptyPage<AppVideo>() },
  );
}
