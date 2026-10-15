import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth';
import { isAdminRequest } from '@/lib/tube/admin';
import { runSync } from '@/lib/tube/scraper';

export const dynamic = 'force-dynamic';
/** A deep backfill is expected to take minutes; never let the platform cut it short. */
export const maxDuration = 3600;

/**
 * POST /api/admin/sync — run a sync from the dashboard.
 *
 * Awaits the run so the panel gets the real summary back (added / updated / errors
 * per source) rather than a fire-and-forget acknowledgement. A deep backfill can
 * take many minutes; the panel says so before you press it.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  let body: { pages?: unknown; maxFetches?: unknown; sources?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* Defaults below. */
  }

  const clamp = (value: unknown, fallback: number, min: number, max: number): number => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
  };

  const sources = Array.isArray(body.sources) ? body.sources.filter((id): id is string => typeof id === 'string') : [];

  try {
    const summary = await runSync({
      trigger: 'manual',
      pagesPerSource: clamp(body.pages, 2, 1, 400),
      maxPostFetches: clamp(body.maxFetches, 30, 1, 2000),
      ...(sources.length > 0 ? { sources } : {}),
    });
    return NextResponse.json({ data: summary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
