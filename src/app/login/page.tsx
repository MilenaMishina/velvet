import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth/auth-form';
import { getCurrentUser } from '@/lib/auth';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to comment and keep your place.',
};

/** Reads the session cookie, so it can never be static. */
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; mode?: string };
}) {
  // Already signed in — nothing to do here.
  if (await getCurrentUser()) redirect(routes.home);

  return (
    <div className="py-6 sm:py-12">
      <AuthForm mode="login" redirectTo={searchParams.next} />
    </div>
  );
}
