import type { NextRequest } from 'next/server';

import { emptyPage, serveEnvelope } from '@/lib/api/envelope';
import { parseCount, parsePageToken } from '@/lib/api/params';
import { serverEnv } from '@/lib/env';
import { resolveCategoryParam } from '@/lib/youtube/categories';
import type { AppVideo } from '@/lib/youtube/models';
import { getTrendingFeed } from '@/lib/youtube/service';

/**
 * GET /api/youtube/feed?category=music&pageToken=…&max=24
 *
 * The home and category feeds. Backed by `videos.list?chart=mostPopular` (1 unit)
 * rather than `search.list` (100 units) — see `service/feed.ts`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const categoryParam = params.get('category');
  const category = categoryParam ? resolveCategoryParam(categoryParam) : undefined;

  return serveEnvelope(
    () =>
      getTrendingFeed({
        categoryId: category?.id ?? null,
        pageToken: parsePageToken(params.get('pageToken')),
        maxResults: parseCount(params.get('max'), 24),
      }),
    { ttlSeconds: serverEnv.cache.ttl.trending, fallback: emptyPage<AppVideo>() },
  );
}
