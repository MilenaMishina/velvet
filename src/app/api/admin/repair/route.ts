import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth';
import { isAdminRequest } from '@/lib/tube/admin';
import { repairUnplayableVideos } from '@/lib/tube/resolve';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/repair — re-read the source pages of videos we could only link to.
 *
 * Bounded per call on purpose: each row costs a fetch to a third party, so the run
 * stays short, reports what it found, and can be repeated until the queue drains
 * rather than holding one long request open against nine different sites.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  let limit = 25;
  try {
    const body = (await request.json()) as { limit?: unknown };
    const parsed = Number(body.limit);
    if (Number.isFinite(parsed)) limit = Math.min(60, Math.max(1, Math.round(parsed)));
  } catch {
    /* Default batch. */
  }

  const summary = await repairUnplayableVideos(limit);
  return NextResponse.json({ data: summary }, { headers: { 'Cache-Control': 'no-store' } });
}
