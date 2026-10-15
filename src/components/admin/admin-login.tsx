'use client';

import { KeyRound, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';

/**
 * Admin gate.
 *
 * A password, not an account: `ADMIN_PASSWORD` is exchanged for an HMAC-signed
 * cookie. Deliberately separate from visitor accounts — membership must never be a
 * route to operating the site, and the operator shouldn't need a member account to
 * moderate one.
 */
export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Incorrect password.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm py-10">
      <form onSubmit={submit} className="panel rounded-card px-6 py-8 shadow-card">
        <span className="brand-gradient grid size-11 place-items-center rounded-control shadow-glow">
          <KeyRound className="size-5 text-primary-foreground" aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-xl font-bold tracking-[-0.02em]">Admin</h1>
        <p className="mt-1.5 text-sm text-foreground-muted">
          Enter the site password to manage sources, settings and moderation.
        </p>

        <label htmlFor="admin-password" className="mt-6 block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          className="panel mt-1.5 h-11 w-full rounded-control px-3 text-sm outline-none focus:shadow-glow"
          placeholder="••••••••"
        />

        {error ? (
          <p role="alert" className="mt-3 rounded-control bg-danger/12 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" pill className="mt-5 w-full" disabled={pending || !password}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? 'Checking…' : 'Unlock dashboard'}
        </Button>

        <p className="mt-4 text-2xs leading-relaxed text-foreground-subtle">
          Set <code className="rounded bg-surface-sunken px-1">ADMIN_PASSWORD</code> in <code className="rounded bg-surface-sunken px-1">.env.local</code> —
          the default is <code className="rounded bg-surface-sunken px-1">admin123</code> and must be changed before this is public.
        </p>
      </form>
    </div>
  );
}
