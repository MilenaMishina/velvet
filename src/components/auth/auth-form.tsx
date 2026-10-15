'use client';

import { Loader2, LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-constants';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export type AuthMode = 'login' | 'signup';

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to comment, and to keep your place across visits.',
    action: 'Sign in',
    icon: LogIn,
    swapPrompt: 'New here?',
    swapLabel: 'Create an account',
    swapHref: routes.signup,
  },
  signup: {
    title: 'Create your account',
    subtitle: 'An email and a password is all it takes. No card, no third party.',
    action: 'Create account',
    icon: UserPlus,
    swapPrompt: 'Already have an account?',
    swapLabel: 'Sign in',
    swapHref: routes.login,
  },
} as const;

/**
 * Sign in / sign up.
 *
 * One component for both because the only differences are copy and which endpoint
 * it posts to — a single `mode` keeps the two forms from drifting apart in
 * validation or error handling.
 */
export function AuthForm({ mode, redirectTo }: { mode: AuthMode; redirectTo?: string }) {
  const router = useRouter();
  const copy = COPY[mode];
  const Icon = copy.icon;

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(mode === 'signup' ? { displayName } : {}) }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; data?: unknown };
      if (!response.ok) {
        setError(body.error ?? 'Something went wrong. Try again.');
        return;
      }
      // `refresh` so server components re-read the (now signed-in) state.
      router.replace(redirectTo && redirectTo.startsWith('/') ? redirectTo : routes.home);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="panel rounded-card px-6 py-8 shadow-card sm:px-8">
        <span className="brand-gradient grid size-11 place-items-center rounded-control shadow-glow">
          <Icon className="size-5 text-primary-foreground" aria-hidden />
        </span>

        <h1 className="mt-5 font-display text-2xl font-bold tracking-[-0.02em]">{copy.title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{copy.subtitle}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {mode === 'signup' ? (
            <Field
              id="displayName"
              label="Display name"
              hint="Shown on your comments. Optional."
              value={displayName}
              onChange={setDisplayName}
              autoComplete="nickname"
              placeholder="e.g. nightowl"
              maxLength={40}
            />
          ) : null}

          <Field
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />

          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD_LENGTH} characters` : '••••••••'}
            required
          />

          {error ? (
            <p role="alert" className="rounded-control bg-danger/12 px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" pill className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
            {pending ? 'Just a moment…' : copy.action}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-foreground-subtle">
          {copy.swapPrompt}{' '}
          <Link href={copy.swapHref} className="font-semibold text-primary transition-colors hover:underline">
            {copy.swapLabel}
          </Link>
        </p>
      </div>

      <p className="mt-4 px-2 text-center text-2xs leading-relaxed text-foreground-subtle">
        Accounts live in this site&rsquo;s own database. Passwords are hashed with scrypt and never leave the server.
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  type = 'text',
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  hint?: string;
  type?: string;
  value: string;
  onChange: (next: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'value' | 'onChange'>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'panel h-11 w-full rounded-control px-3 text-sm text-foreground outline-none transition-shadow',
          'placeholder:text-foreground-subtle focus:shadow-glow',
        )}
      />
      {hint ? <p className="text-2xs text-foreground-subtle">{hint}</p> : null}
    </div>
  );
}
