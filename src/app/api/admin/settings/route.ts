import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth';
import { isAdminRequest } from '@/lib/tube/admin';
import { setSetting } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * Settings the dashboard is allowed to write.
 *
 * An allow-list, not a free-for-all: without it a typo in a key name would silently
 * create a setting nothing reads, and the panel would look like it worked.
 */
const EDITABLE = new Set(['auto_sync_minutes', 'hide_link_only', 'site_notice']);

/** POST /api/admin/settings — update one runtime setting. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  let body: { key?: unknown; value?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key : '';
  if (!EDITABLE.has(key)) {
    return NextResponse.json({ error: 'Unknown setting.' }, { status: 400 });
  }

  const raw = body.value;
  const value =
    typeof raw === 'boolean' ? (raw ? '1' : '0')
    : typeof raw === 'number' ? String(raw)
    : typeof raw === 'string' ? raw.slice(0, 500)
    : '';

  setSetting(key, value);
  return NextResponse.json({ data: { key, value } }, { headers: { 'Cache-Control': 'no-store' } });
}
