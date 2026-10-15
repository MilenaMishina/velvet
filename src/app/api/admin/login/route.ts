import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { sessionCookieOptions } from '@/lib/tube/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    /* handled below */
  }

  const expected = process.env.ADMIN_PASSWORD?.trim() || 'admin123';
  if (!password || password !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const cookie = sessionCookieOptions();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: cookie.maxAge,
    path: '/',
  });
  return response;
}
