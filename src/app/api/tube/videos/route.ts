import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { listPinnedVideos, listVideos, topSources } from '@/lib/tube/db';
import { ensureAutoSyncScheduler } from '@/lib/tube/scraper';
import type { TubeSort } from '@/lib/tube/models';

export const dynamic = 'force-dynamic';

/**
 * Public tube feed.
 *
 * Lazily starts the in-process auto-sync scheduler on first hit so a long-running
 * server keeps pulling new videos even without an external cron.
 */
export async function GET(request: NextRequest) {
  ensureAutoSyncScheduler();

  const params = request.nextUrl.searchParams;
  const q = params.get('q')?.trim() || undefined;
  const sourceId = params.get('source')?.trim() || undefined;
  const tag = params.get('tag')?.trim() || undefined;
  const sortRaw = params.get('sort');
  const sort: TubeSort = sortRaw === 'views' || sortRaw === 'oldest' ? sortRaw : 'newest';
  const page = Number(params.get('page') ?? '1');
  const perPage = Number(params.get('perPage') ?? '24');

  const result = listVideos({
    q,
    sourceId,
    tag,
    sort,
    excludePinned: params.get('excludePinned') === 'true',
    page: Number.isFinite(page) ? page : 1,
    perPage: Number.isFinite(perPage) ? perPage : 24,
  });

  return NextResponse.json(
    // Pins ride along with every page so a "load more" never needs to know which
    // rows the shelf above it already took.
    { data: { ...result, sources: topSources(8), pinned: listPinnedVideos(8) } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
