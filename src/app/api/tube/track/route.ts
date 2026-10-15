import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { newVisitorId, VISITOR_COOKIE_NAME } from '@/lib/tube/admin';
import { recordVisit } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * Anonymous visitor tracking beacon.
 *
 * The client posts the current path; the first POST assigns a random visitor id
 * in an httpOnly cookie so the admin panel can count unique visitors without
 * accounts or third-party analytics.
 */
export async function POST(request: NextRequest) {
  let path = '/';
  try {
    const body = (await request.json()) as { path?: unknown };
    if (typeof body.path === 'string' && body.path.startsWith('/')) path = body.path.slice(0, 300);
  } catch {
    /* Malformed beacons are ignored — tracking is best-effort. */
  }

  const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  const visitorId = existing || newVisitorId();
  recordVisit(visitorId, path);

  const response = NextResponse.json({ ok: true });
  if (!existing) {
    response.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return response;
}
