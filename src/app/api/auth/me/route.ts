import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me — the signed-in user, or null.
 *
 * `private` + `no-store` because the response is per-visitor and must never land in
 * a shared cache between two different accounts.
 */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(
    { data: { user } },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
