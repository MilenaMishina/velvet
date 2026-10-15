'use client';

import * as React from 'react';

import type { SessionUser } from '@/lib/auth-constants';

/**
 * The signed-in user, fetched on the client.
 *
 * The root layout is deliberately static, so it can't read the session cookie —
 * doing so would opt every page in the app into dynamic rendering. Accounts are
 * therefore resolved here, the same way the source rail resolves its list.
 */
export function useCurrentUser(): { user: SessionUser | null; ready: boolean } {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/auth/me', { signal: controller.signal, headers: { Accept: 'application/json' } });
        const body = (await response.json()) as { data?: { user?: SessionUser | null } };
        if (!controller.signal.aborted) setUser(body.data?.user ?? null);
      } catch {
        /* Signed out is a perfectly good default. */
      } finally {
        if (!controller.signal.aborted) setReady(true);
      }
    })();
    return () => controller.abort();
  }, []);

  return { user, ready };
}

/** POST the logout endpoint and reload so server components see the new state. */
export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  window.location.href = '/';
}
