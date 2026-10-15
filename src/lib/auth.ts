import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import {
  countUsers,
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
  getUserCredentials,
  type TubeUser,
} from '@/lib/tube/db';

/**
 * Accounts, self-hosted.
 *
 * The whole catalogue already lives in a local SQLite file, so introducing a hosted
 * identity provider would mean an external account, an API key and a network
 * dependency for a login form. Passwords are hashed with `scrypt` (memory-hard, in
 * Node's standard library) and sessions are rows in the same database — which also
 * means a logout or a password change genuinely ends every session instead of
 * waiting out a token's lifetime.
 *
 * The first account created owns the site and gets the `admin` role; everyone after
 * that is a `member`. That is the whole provisioning story: sign up once to become
 * the operator.
 */

const KEY_LENGTH = 64;
const SESSION_TTL_DAYS = 30;

export const SESSION_COOKIE_NAME = 'velvet_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

/** `scrypt:<salt>:<hash>` — the scheme is stored so it can be changed later. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, KEY_LENGTH).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  // Constant-time compare: a length-equal early-exit would leak the hash byte by byte.
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function startSession(userId: string): string {
  const token = randomBytes(32).toString('hex');
  createSession(token, userId, SESSION_TTL_DAYS);
  return token;
}

export function endSession(token: string | undefined | null): void {
  if (token) deleteSession(token);
}

/** Current visitor, or null. Server-only — reads the session cookie. */
export async function getCurrentUser(): Promise<TubeUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? getSessionUser(token) : null;
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export interface SignupInput {
  email: string;
  password: string;
  displayName?: string;
}

export type AuthOutcome = { ok: true; user: TubeUser } | { ok: false; error: string };

export const MIN_PASSWORD_LENGTH = 8;

export function registerUser(input: SignupInput): AuthOutcome {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
  }
  if (getUserCredentials(email)) return { ok: false, error: 'That email is already registered.' };

  const displayName = (input.displayName?.trim() || email.split('@')[0] || 'Member').slice(0, 40);
  const user = createUser({
    id: randomUUID(),
    email,
    displayName,
    passwordHash: hashPassword(input.password),
    // The account that creates the site is its operator.
    role: countUsers() === 0 ? 'admin' : 'member',
  });
  return { ok: true, user };
}

export function authenticate(email: string, password: string): AuthOutcome {
  const found = getUserCredentials(normalizeEmail(email));
  // Same message either way: telling the caller which half was wrong is a free
  // account-enumeration oracle.
  if (!found || !verifyPassword(password, found.passwordHash)) {
    return { ok: false, error: 'Email or password is incorrect.' };
  }
  return { ok: true, user: found.user };
}

/**
 * Reject a mutation that didn't come from our own pages.
 *
 * Cookies are `SameSite=Lax`, which already blocks a cross-site POST, but a
 * credentialed `fetch` from another origin is worth refusing explicitly rather than
 * relying on browser defaults alone.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Same-origin fetches may omit Origin entirely.
  const host = request.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
