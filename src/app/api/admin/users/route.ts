import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { changeUserRole, findUser, isSameOriginRequest, removeUser } from '@/lib/auth';
import { isAdminRequest } from '@/lib/tube/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users — promote, demote or remove an account.
 *
 * Removing an account ends its sessions but keeps its comments (they render as
 * "Deleted account"), so a thread stays readable rather than developing holes.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  let body: { id?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const action = typeof body.action === 'string' ? body.action : '';
  if (!id) return NextResponse.json({ error: 'Missing account id.' }, { status: 400 });

  // Confirm the account exists before acting, so a stale admin table cannot set a role
  // on — or "delete" — an id that is already gone.
  const existing = await findUser(id);
  if (!existing.ok) return NextResponse.json({ error: existing.error }, { status: 502 });
  if (!existing.data) return NextResponse.json({ error: 'Unknown account.' }, { status: 404 });

  if (action === 'promote' || action === 'demote') {
    const changed = await changeUserRole(id, action === 'promote' ? 'admin' : 'member');
    if (!changed.ok) return NextResponse.json({ error: changed.error }, { status: 502 });
    return NextResponse.json({ ok: true, user: changed.data }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'delete') {
    const removed = await removeUser(id);
    if (!removed.ok) return NextResponse.json({ error: removed.error }, { status: 502 });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
