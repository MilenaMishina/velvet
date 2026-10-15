import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth';
import { isAdminRequest } from '@/lib/tube/admin';
import { createSource, setSourceEnabled } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/sources — park or resume a source.
 *
 * Disabling is how a source is taken offline: the sync skips it entirely, so no
 * requests are made and no new rows appear, while everything already indexed stays
 * browsable and attributed.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  let body: { id?: unknown; enabled?: unknown; action?: unknown; name?: unknown; baseUrl?: unknown; aspectRatio?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  // `create` makes a hand-filled section: a named bucket in the rail that no adapter
  // crawls, for videos the operator adds themselves.
  if (body.action === 'create') {
    const aspect = Number(body.aspectRatio);
    const result = createSource({
      id: typeof body.id === 'string' ? body.id : '',
      name: typeof body.name === 'string' ? body.name : '',
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
      ...(Number.isFinite(aspect) && aspect > 0 ? { aspectRatio: aspect } : {}),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'Missing source id.' }, { status: 400 });

  setSourceEnabled(id, Boolean(body.enabled));
  return NextResponse.json({ data: { id, enabled: Boolean(body.enabled) } }, { headers: { 'Cache-Control': 'no-store' } });
}
