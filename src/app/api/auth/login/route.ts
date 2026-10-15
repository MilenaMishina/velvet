import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  authenticate,
  isSameOriginRequest,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  startSession,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST /api/auth/login — exchange credentials for a session cookie. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request refused.' }, { status: 403 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const result = await authenticate(email, password);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const token = startSession(result.user);
  const response = NextResponse.json({ data: { user: result.user } }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
