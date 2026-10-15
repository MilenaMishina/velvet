import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

import {
  AUTH_NOT_CONFIGURED,
  countAuthUsers,
  createAuthUser,
  deleteAuthUser,
  getAuthUser,
  hasAnyAuthUser,
  isAuthConfigured,
  listAuthUsers,
  setAuthUserRole,
  signInWithPassword,
  type AuthResult,
  type AuthUser,
} from '@/lib/supabase-auth';
import {
  commentCountsByUser,
  createSession,
  deleteSession,
  deleteUserSessions,
  getSession,
  sessionStatsByUser,
  touchSession,
  type AuthSessionRow,
} from '@/lib/tube/db';

/**
 * Accounts, hosted on Supabase.
 *
 * The catalogue stays in the local SQLite file, but identities do not: sign-up,
 * sign-in and the account record itself are Supabase's job. What remains here is the
 * part Supabase should not decide for us — which session cookie this deployment
 * trusts, and who counts as an operator.
 *
 * The cookie is still ours. It points at a row in `auth_sessions` holding a snapshot
 * of the account, so rendering a page never waits on a network call and signing out
 * genuinely ends the session rather than waiting out a token. That snapshot is re-read
 * from Supabase periodically, so promoting, renaming or deleting an account reaches a
 * session that is already open.
 *
 * The first account created owns the site and gets `admin`; everyone after that is a
 * `member`. That is the whole provisioning story: sign up once to become the operator.
 */

const SESSION_TTL_DAYS = 30;

export const SESSION_COOKIE_NAME = 'velvet_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

/** How long a cached snapshot is trusted before the account is re-read. */
const REVALIDATE_MS = 10 * 60 * 1000;

export const MIN_PASSWORD_LENGTH = 8;

function snapshot(session: AuthSessionRow): AuthUser {
  return {
    id: session.userId,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
    createdAt: session.createdAt,
  };
}

export function startSession(user: AuthUser): string {
  const token = randomBytes(32).toString('hex');
  createSession({
    token,
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    ttlDays: SESSION_TTL_DAYS,
  });
  return token;
}

export function endSession(token: string | undefined | null): void {
  if (token) deleteSession(token);
}

/**
 * The current visitor, or null.
 *
 * Server-only — reads the session cookie. Identity comes from the local snapshot
 * until it goes stale. If Supabase is unreachable when it does, the snapshot we
 * already validated keeps being served rather than signing everyone out; only a
 * definite "this account is gone" ends the session.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const session = getSession(token);
  if (!session) return null;
  if (Date.now() - Date.parse(session.syncedAt) < REVALIDATE_MS) return snapshot(session);

  const fresh = await getAuthUser(session.userId);
  if (!fresh.ok) return snapshot(session);
  if (!fresh.data) {
    deleteSession(token);
    return null;
  }
  touchSession(token, {
    email: fresh.data.email,
    displayName: fresh.data.displayName,
    role: fresh.data.role,
  });
  return fresh.data;
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

/** `status` lets a route answer a misconfiguration (503) differently from bad input (400). */
export type AuthOutcome =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string; status?: number };

/**
 * Create an account — already usable, then the caller starts its session.
 *
 * Validation runs here first so the visitor gets a sentence instead of a raw provider
 * error, then Supabase creates and confirms the account.
 */
export async function registerUser(input: SignupInput): Promise<AuthOutcome> {
  if (!isAuthConfigured()) return { ok: false, error: AUTH_NOT_CONFIGURED, status: 503 };

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
  }

  const displayName = (input.displayName?.trim() || email.split('@')[0] || 'Member').slice(0, 40);

  // The account that creates the site is its operator. Checked before the insert, so
  // two genuinely simultaneous first signups could both end up admin; the window is
  // one request wide and the cost is a spare admin, not a locked-out site.
  const existing = await hasAnyAuthUser();
  if (!existing.ok) return { ok: false, error: existing.error, status: upstreamStatus(existing.status) };

  const created = await createAuthUser({
    email,
    password: input.password,
    displayName,
    role: existing.data ? 'member' : 'admin',
  });
  // A duplicate address or a rejected password is the visitor's to fix; anything the
  // provider reported as its own failure is not.
  if (!created.ok) return { ok: false, error: created.error, status: upstreamStatus(created.status, 400) };
  return { ok: true, user: created.data };
}

/**
 * Exchange credentials for an account.
 *
 * Supabase returns one message whichever half was wrong, which is the same
 * account-enumeration behaviour the local implementation had — so it is passed
 * straight through rather than invented again here.
 */
export async function authenticate(email: string, password: string): Promise<AuthOutcome> {
  if (!isAuthConfigured()) return { ok: false, error: AUTH_NOT_CONFIGURED, status: 503 };
  const result = await signInWithPassword(normalizeEmail(email), password);
  // 401 is the honest answer to a refused sign-in; a provider fault is not the
  // visitor's credentials being wrong.
  return result.ok ? { ok: true, user: result.data } : { ok: false, error: result.error, status: upstreamStatus(result.status, 401) };
}

/** Translate a provider status into one we are willing to send back to a visitor. */
function upstreamStatus(status: number, clientError = 502): number {
  if (status === 0) return 503;
  if (status >= 500 || status === 429) return 502;
  return clientError;
}

/** Accounts for the operator table: Supabase records joined with local activity. */
export interface AdminUserRow extends AuthUser {
  commentCount: number;
  sessionCount: number;
  lastLoginAt: string | null;
}

export async function adminUserRows(limit = 100): Promise<AuthResult<AdminUserRow[]>> {
  const users = await listAuthUsers(limit);
  if (!users.ok) return users;
  const comments = commentCountsByUser();
  const sessions = sessionStatsByUser();
  return {
    ok: true,
    data: users.data.map((user) => ({
      ...user,
      commentCount: comments[user.id] ?? 0,
      sessionCount: sessions[user.id]?.count ?? 0,
      lastLoginAt: sessions[user.id]?.lastLoginAt ?? null,
    })),
  };
}

export async function countUsers(): Promise<AuthResult<number>> {
  return countAuthUsers();
}

export async function findUser(id: string): Promise<AuthResult<AuthUser | null>> {
  return getAuthUser(id);
}

export async function changeUserRole(id: string, role: 'member' | 'admin'): Promise<AuthResult<AuthUser>> {
  return setAuthUserRole(id, role);
}

/**
 * Remove an account and end its sessions.
 *
 * Its comments stay behind, rendering as "Deleted account", so a thread remains
 * readable and no video's comment counter goes out of step.
 */
export async function removeUser(id: string): Promise<AuthResult<true>> {
  const result = await deleteAuthUser(id);
  if (!result.ok) return result;
  // The account is gone, so every cookie pointing at it must stop working now.
  deleteUserSessions(id);
  return result;
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
