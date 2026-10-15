import { Compass } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

/** 404 — reached for unknown routes and for a video that has left our index. */
export default function NotFound() {
  return (
    <div className="panel mx-auto max-w-lg rounded-card px-6 py-14 text-center shadow-card">
      <span className="brand-gradient mx-auto grid size-12 place-items-center rounded-full shadow-glow">
        <Compass className="size-5 text-primary-foreground" aria-hidden />
      </span>

      <p className="mt-5 font-display text-4xl font-bold tracking-[-0.03em] brand-text">404</p>
      <h1 className="mt-1 font-display text-xl font-semibold tracking-[-0.02em]">Nothing to watch here</h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        This page doesn’t exist, or the video it pointed to has been removed from our index since it was scraped.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" size="md" pill asChild>
          <Link href={routes.home}>Back to the feed</Link>
        </Button>
        <Button variant="outline" size="md" pill asChild>
          <Link href={routes.tube.index}>Search instead</Link>
        </Button>
      </div>
    </div>
  );
}
