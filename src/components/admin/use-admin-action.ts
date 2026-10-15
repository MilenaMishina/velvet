'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

/**
 * One request/refresh/error path for every admin action.
 *
 * Shared so that every button in the console reports failures the same way — and so
 * a refresh after a mutation is never forgotten, which is the usual way a dashboard
 * starts lying about the state it is showing.
 */
export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const run = React.useCallback(
    async <T,>(key: string, url: string, body?: unknown, successNote?: string): Promise<T | null> => {
      setBusy(key);
      setError(null);
      setNote(null);
      try {
        const response = await fetch(url, {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string; data?: T };
        if (!response.ok) {
          setError(payload.error ?? `Request failed (${response.status}).`);
          return null;
        }
        if (successNote) setNote(successNote);
        router.refresh();
        return (payload.data ?? null) as T | null;
      } catch {
        setError('Could not reach the server.');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [router],
  );

  return { run, busy, error, note, setError, setNote };
}
