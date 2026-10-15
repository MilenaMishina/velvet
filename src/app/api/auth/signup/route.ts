import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  isSameOriginRequest,
  registerUser,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  startSession,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST /api/auth/signup — create an account and sign it in. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request refused.' }, { status: 403 });
  }

  let body: { email?: unknown; password?: unknown; displayName?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName : undefined;

  const result = registerUser({ email, password, displayName });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const token = startSession(result.user.id);
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
