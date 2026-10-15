'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

/**
 * Route error boundary.
 *
 * Shows a recoverable message and logs the digest — never the raw stack, which can
 * leak internals. A source being unreachable is handled far earlier (the sync simply
 * records it against `sync_runs`), so reaching here means something genuinely
 * unexpected happened.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error('[route] unhandled error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="panel mx-auto max-w-lg rounded-card px-6 py-14 text-center shadow-card">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger/15 text-danger">
        <TriangleAlert className="size-5" aria-hidden />
      </span>

      <h1 className="mt-5 font-display text-xl font-bold tracking-[-0.02em]">That didn’t load</h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        Something broke while rendering this page. Trying again usually fixes it.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" size="md" pill onClick={reset}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <Button variant="outline" size="md" pill asChild>
          <Link href={routes.home}>Back to the feed</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-5 text-2xs text-foreground-subtle">
          Reference: <code>{error.digest}</code>
        </p>
      ) : null}
    </div>
  );
}
