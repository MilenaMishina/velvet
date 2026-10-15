/**
 * Accounts, hosted on Supabase.
 *
 * This module is the only place that talks to Supabase, and it is server-only on
 * purpose: the secret key is a full-admin credential, so it must never reach the
 * browser bundle or a public variable. Every call therefore goes out from a route
 * handler or a server component, over HTTPS.
 *
 * Three things worth knowing about the design:
 *
 * - The **secret key** does account administration: create, list, rename roles and
 *   delete. The **publishable key** is only ever used to exchange an email and
 *   password for a session, which is the one operation an anonymous visitor is
 *   allowed to attempt.
 * - The application's own role (`member` / `admin`) lives in `app_metadata`, not
 *   `user_metadata`. Supabase refuses to let a signed-in user write `app_metadata`
 *   (403 `not_admin`), so a member cannot promote themselves; `user_metadata` is
 *   self-writable and holds only cosmetic values like the display name.
 * - Accounts are created already-confirmed (`email_confirm: true`). This project has
 *   `mailer_autoconfirm: false` and no SMTP sender, so a confirmation email can never
 *   be delivered and a self-service signup would dead-end. Confirming at creation
 *   keeps the sign-up flow working; see README for the alternative once SMTP exists.
 */

/** Fields this app treats as an account, independent of Supabase's own shape. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'member' | 'admin';
  createdAt: string;
}

/** A user as Supabase returns it (only the parts we read). */
interface SupabaseUser {
  id?: unknown;
  email?: unknown;
  created_at?: unknown;
  user_metadata?: { display_name?: unknown } | null;
  app_metadata?: { app_role?: unknown } | null;
}

interface SupabaseSession {
  access_token?: unknown;
  refresh_token?: unknown;
}

export type AuthResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function supabaseUrl(): string {
  return env('SUPABASE_URL').replace(/\/+$/, '');
}

/**
 * True when this deployment can manage accounts at all.
 *
 * Both keys are required: sign-in needs the publishable key, and everything else
 * needs the secret key. Without them the UI shows "accounts are not configured"
 * rather than a misleading password error.
 */
export function isAuthConfigured(): boolean {
  return Boolean(supabaseUrl() && env('SUPABASE_PUBLISHABLE_KEY') && env('SUPABASE_SECRET_KEY'));
}

export const AUTH_NOT_CONFIGURED =
  'Accounts are not configured on this deployment. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.';

/** Supabase error codes that deserve a sentence a human can act on. */
function friendlyError(code: string | undefined, status: number): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Email or password is incorrect.';
    case 'email_exists':
    case 'user_already_exists':
      return 'That email is already registered.';
    case 'email_address_invalid':
      return 'Enter a valid email address.';
    case 'weak_password':
      return 'That password is too weak. Use at least 8 characters.';
    case 'signup_disabled':
      return 'New accounts are switched off for this project.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Wait a minute and try again.';
    default:
      break;
  }
  if (status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (status >= 500) return 'The account service is having trouble. Try again shortly.';
  return 'The account service refused that request.';
}

async function request<T>(
  path: string,
  options: { key: 'publishable' | 'secret'; method?: string; body?: unknown; bearer?: string },
): Promise<AuthResult<T>> {
  const url = supabaseUrl();
  if (!url) return { ok: false, status: 0, error: AUTH_NOT_CONFIGURED };
  const key = options.key === 'secret' ? env('SUPABASE_SECRET_KEY') : env('SUPABASE_PUBLISHABLE_KEY');
  if (!key) return { ok: false, status: 0, error: AUTH_NOT_CONFIGURED };

  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: key };
  if (options.bearer) headers.Authorization = `Bearer ${options.bearer}`;

  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // Never let a stalled identity provider hold a page render open.
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'unknown';
    console.warn(`[supabase-auth] ${path} unreachable (${reason})`);
    return { ok: false, status: 0, error: 'Could not reach the account service. Try again.' };
  }

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* A non-JSON body is treated as empty; the status code still drives the error. */
  }

  if (!response.ok) {
    const shape = body as { error_code?: string; code?: string; error?: string; msg?: string } | null;
    const code = shape?.error_code ?? shape?.error ?? shape?.msg;
    // Log the code only — never the address or the payload.
    console.warn(`[supabase-auth] ${path} -> ${response.status} ${code ?? ''}`.trim());
    return { ok: false, status: response.status, error: friendlyError(code, response.status) };
  }

  return { ok: true, data: body as T };
}

/** Normalise Supabase's user shape into the app's, with nothing missing. */
export function toAuthUser(row: SupabaseUser): AuthUser {
  const email = String(row.email ?? '');
  const declared = String(row.user_metadata?.display_name ?? '').trim();
  return {
    id: String(row.id ?? ''),
    email,
    displayName: declared || email.split('@')[0] || 'Member',
    role: row.app_metadata?.app_role === 'admin' ? 'admin' : 'member',
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
  };
}

/**
 * Exchange email + password for a session.
 *
 * Anonymous, so this is the one call that uses the publishable key. The tokens
 * Supabase returns are deliberately thrown away: the app's own session cookie is the
 * gate, and a stale identity is re-read through the admin API. Keeping a long-lived
 * refresh token in the local database would be a credential worth stealing for no
 * functional gain.
 */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult<AuthUser>> {
  const result = await request<{ user?: SupabaseUser } & SupabaseSession>(
    '/auth/v1/token?grant_type=password',
    { key: 'publishable', method: 'POST', body: { email, password } },
  );
  if (!result.ok) return result;
  if (!result.data.user?.id) return { ok: false, status: 500, error: 'That sign-in response was incomplete.' };
  return { ok: true, data: toAuthUser(result.data.user) };
}

/**
 * Create an account, already confirmed.
 *
 * Uses the admin API rather than public signup so the account is usable the moment
 * it exists — see the module comment about the missing mailer.
 */
export async function createAuthUser(input: {
  email: string;
  password: string;
  displayName: string;
  role: 'member' | 'admin';
}): Promise<AuthResult<AuthUser>> {
  const result = await request<SupabaseUser>('/auth/v1/admin/users', {
    key: 'secret',
    method: 'POST',
    body: {
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { display_name: input.displayName },
      app_metadata: { app_role: input.role },
    },
  });
  if (!result.ok) return result;
  if (!result.data?.id) return { ok: false, status: 500, error: 'That account could not be created.' };
  return { ok: true, data: toAuthUser(result.data) };
}

/** One account, or null when it no longer exists. */
export async function getAuthUser(id: string): Promise<AuthResult<AuthUser | null>> {
  const result = await request<SupabaseUser>(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { key: 'secret' });
  if (!result.ok) {
    // A deleted account is a normal outcome, not a failure to report as an error.
    if (result.status === 404) return { ok: true, data: null };
    return result;
  }
  return { ok: true, data: toAuthUser(result.data) };
}

/**
 * Accounts, newest first.
 *
 * Supabase's admin list is paginated and reports no total, so this pages until it
 * has enough rows for the requested limit.
 */
export async function listAuthUsers(limit = 200): Promise<AuthResult<AuthUser[]>> {
  const target = Math.max(1, limit);
  const perPage = Math.min(1000, target);
  const collected: AuthUser[] = [];
  let page = 1;
  while (collected.length < target) {
    const result = await request<{ users?: SupabaseUser[] }>(
      `/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { key: 'secret' },
    );
    if (!result.ok) return result;
    const batch = Array.isArray(result.data?.users) ? result.data.users : [];
    collected.push(...batch.filter((row) => row?.id).map(toAuthUser));
    if (batch.length < perPage) break;
    page += 1;
    if (page > 20) break; // 20,000 accounts is far past the point of a UI table.
  }
  collected.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { ok: true, data: collected.slice(0, target) };
}

/**
 * Whether any account exists yet.
 *
 * The first account created owns the site, so sign-up needs to know if this is the
 * first one. Asking for a single row answers that without listing the table.
 */
export async function hasAnyAuthUser(): Promise<AuthResult<boolean>> {
  const result = await request<{ users?: SupabaseUser[] }>('/auth/v1/admin/users?page=1&per_page=1', {
    key: 'secret',
  });
  if (!result.ok) return result;
  return { ok: true, data: Array.isArray(result.data?.users) && result.data.users.length > 0 };
}

export async function countAuthUsers(): Promise<AuthResult<number>> {
  const result = await listAuthUsers(1000);
  return result.ok ? { ok: true, data: result.data.length } : result;
}

/** Promote or demote. Writes `app_metadata`, which only this key can touch. */
export async function setAuthUserRole(id: string, role: 'member' | 'admin'): Promise<AuthResult<AuthUser>> {
  const result = await request<SupabaseUser>(`/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    key: 'secret',
    method: 'PUT',
    body: { app_metadata: { app_role: role } },
  });
  if (!result.ok) return result;
  return { ok: true, data: toAuthUser(result.data) };
}

export async function deleteAuthUser(id: string): Promise<AuthResult<true>> {
  const result = await request<unknown>(`/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    key: 'secret',
    method: 'DELETE',
  });
  return result.ok ? { ok: true, data: true } : result;
}
