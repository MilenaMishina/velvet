import { Globe2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { formatCompactNumber } from '@/lib/format';
import { routes } from '@/lib/routes';
import { listSourcesWithCounts, tubeStats } from '@/lib/tube/db';

export const metadata: Metadata = {
  title: 'Sources',
  description: 'Every site the catalogue indexes, with live counts of what we hold.',
};

export const dynamic = 'force-dynamic';

export default function SourcesPage() {
  const sources = listSourcesWithCounts();
  const stats = tubeStats();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <Globe2 className="size-3.5" aria-hidden />
            {sources.length} sites indexed
          </>
        }
        title="Sources"
        description={`Every site the catalogue is built from — ${formatCompactNumber(stats.publishedVideos)} scenes and counting. Pick a site to browse only its feed.`}
      />

      {sources.length === 0 ? (
        <p className="panel rounded-card p-8 text-center text-sm text-foreground-muted">
          Nothing indexed yet. Run a sync from the admin console, then reload.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sources.map((source) => (
            <li key={source.id}>
              <Link
                href={routes.tube.filtered({ source: source.id })}
                className="panel group flex items-center justify-between gap-4 rounded-card px-5 py-4 transition-all duration-300 ease-spring hover:border-primary/50 hover:shadow-lifted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-semibold tracking-[-0.01em] transition-colors group-hover:text-primary">
                    {source.name}
                  </span>
                  <span className="mt-0.5 block text-2xs uppercase tracking-wider text-foreground-subtle">
                    {source.count > 0 ? `${formatCompactNumber(source.count)} videos` : 'awaiting first sync'}
                  </span>
                </span>
                <span className="tabular-nums text-lg font-bold text-foreground-subtle transition-colors group-hover:text-primary">
                  {source.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
