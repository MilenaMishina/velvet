import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { runSync } from '@/lib/tube/scraper';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sync — the on-demand sync trigger.
 *
 * `.env.example` has documented this endpoint (and `CRON_SECRET`) since the tube
 * module landed, but the route itself was never created, which is why nothing was
 * ever indexed. A sync walks a couple of listing pages per source and upserts what
 * it finds, so it is worth running behind a secret and never from the browser.
 *
 * A routine run walks 2 listing pages per source and takes roughly a minute (post
 * fetches are rate-limited on purpose), so call it with a generous client timeout:
 *
 *   curl "http://localhost:3000/api/cron/sync?secret=$CRON_SECRET"
 *
 * For a first-time backfill, ask for depth instead — every source we follow
 * paginates to hundreds of pages, so this is how the catalogue gets built:
 *
 *   curl "http://localhost:3000/api/cron/sync?secret=$CRON_SECRET&pages=60&maxFetches=800&delay=500"
 *
 * That walks ~60 pages per source with a 500 ms gap and is expected to run for many
 * minutes; it is safe to re-run because videos are de-duplicated by their page URL.
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim() || 'dev-cron-key';
  const provided =
    request.nextUrl.searchParams.get('secret') ?? request.headers.get('x-cron-secret') ?? '';

  if (provided !== expected) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret.' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const params = request.nextUrl.searchParams;
  const pages = Number(params.get('pages') ?? '2');
  const maxPostFetches = Number(params.get('maxFetches') ?? '30');
  const delay = Number(params.get('delay') ?? '');
  // The caller says why it is running: the GitHub Actions schedule passes `cron`, so
  // `sync_runs` records the trigger truthfully in the admin panel instead of every
  // automated run looking like a manual one.
  const trigger = params.get('trigger') === 'cron' ? 'cron' : 'manual';
  // `full=1` walks past the incremental watermark and re-reads every known post,
  // expanding multi-video posts stored by an older parser. Deep and slow by design.
  const full = params.get('full') === '1';
  const sources = (params.get('sources') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  try {
    const options = {
      trigger: trigger as 'cron' | 'manual',
      pagesPerSource: Number.isFinite(pages) ? pages : 2,
      maxPostFetches: Number.isFinite(maxPostFetches) ? maxPostFetches : 30,
      ...(sources.length > 0 ? { sources } : {}),
      ...(full ? { full: true } : {}),
      ...(Number.isFinite(delay) && delay >= 0 ? { requestDelayMs: delay } : {}),
    };

    // ── Async mode (the default for automation): the run continues in-process and
    // the HTTP call returns at once. A routine sync does a couple of hundred
    // rate-limited requests; blocking a cron HTTP call for all of them is why the
    // old GitHub action timed out mid-run — the work died with the socket, half
    // the catalogue unindexed. Automation should fire and read `sync_runs` later;
    // an operator who wants the summary synchronously passes `wait=1`.
    if (params.get('wait') !== '1') {
      void runSync(options).catch(() => {
        /* The failure is recorded in sync_runs by runSync itself. */
      });
      return NextResponse.json(
        { data: { started: true, trigger, async: true } },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const summary = await runSync(options);
    return NextResponse.json({ data: summary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Sync failed.',
        },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
