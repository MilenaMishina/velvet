import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Admin authentication for the /admin panel.
 *
 * A password (env `ADMIN_PASSWORD`) is exchanged for an HMAC-signed cookie —
 * no sessions table, no secret material in the project. Verify by recomputing.
 */

const COOKIE_NAME = 'tube_admin';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || 'admin123';
}

function sign(payload: string): string {
  return createHmac('sha256', `tube-admin::${adminPassword()}`).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function createSessionToken(): { token: string; maxAge: number } {
  const expires = Date.now() + SESSION_TTL_MS;
  return { token: `${expires}.${sign(String(expires))}`, maxAge: Math.floor(SESSION_TTL_MS / 1000) };
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresRaw, signature] = token.split('.');
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || !signature) return false;
  if (expires < Date.now()) return false;
  return safeEqual(signature, sign(String(expires)));
}

/** Server-side check for admin API routes and the /admin page. */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export function sessionCookieOptions(): { name: string; value: string; maxAge: number } {
  const { token, maxAge } = createSessionToken();
  return { name: COOKIE_NAME, value: token, maxAge };
}

export function newVisitorId(): string {
  return randomUUID();
}

export const VISITOR_COOKIE_NAME = 'tube_visitor';
