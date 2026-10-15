import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { endSession, getSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST /api/auth/logout — delete the session row, then clear the cookie. */
export async function POST(request: NextRequest) {
  // Deleting the row is what actually ends the session; clearing the cookie is
  // just tidying up the browser.
  endSession(await getSessionToken());

  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  return response;
}
