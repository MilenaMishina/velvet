import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth';
import { isAdminRequest } from '@/lib/tube/admin';
import { deleteUser, getUserById, setUserRole } from '@/lib/tube/db';

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
  if (!getUserById(id)) return NextResponse.json({ error: 'Unknown account.' }, { status: 404 });

  if (action === 'promote' || action === 'demote') {
    const ok = setUserRole(id, action === 'promote' ? 'admin' : 'member');
    return NextResponse.json({ ok }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'delete') {
    return NextResponse.json({ ok: deleteUser(id) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
