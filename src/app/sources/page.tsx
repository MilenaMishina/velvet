import { ArrowUpRight, Globe2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { formatCompactNumber } from '@/lib/format';
import { routes } from '@/lib/routes';
import { listSourcesWithArtwork, tubeStats } from '@/lib/tube/db';

export const metadata: Metadata = {
  title: 'Sources',
  description: 'Every site the catalogue indexes, with live counts of what we hold.',
};

export const dynamic = 'force-dynamic';

/**
 * Studio directory.
 *
 * Each card carries the source's most-watched still under a heavy scrim, so the
 * page reads as a set of channels rather than a settings list. Counts are live
 * from the local index.
 */
export default function SourcesPage() {
  const sources = listSourcesWithArtwork();
  const stats = tubeStats();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <Globe2 className="size-3.5" aria-hidden />
            {sources.length} sites · {formatCompactNumber(stats.publishedVideos)} scenes
          </>
        }
        title="Studios"
        description="Every site the catalogue is built from. Pick one to browse only its feed — every scene still plays from its publisher."
      />

      {sources.length === 0 ? (
        <p className="panel rounded-card p-8 text-center text-sm text-foreground-muted">
          Nothing indexed yet. Run a sync from the admin console, then reload.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sources.map((source) => (
            <li key={source.id}>
              <Link
                href={routes.tube.filtered({ source: source.id })}
                className="group/card relative block isolate aspect-[16/9] overflow-hidden rounded-xl bg-surface-sunken ring-1 ring-white/[0.06] transition-shadow duration-300 hover:shadow-lifted hover:ring-primary/45"
              >
                {source.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote posters are unoptimized by design
                  <img
                    src={source.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover opacity-70 transition-all duration-500 ease-out-quint group-hover/card:scale-105 group-hover/card:opacity-85"
                  />
                ) : null}

                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />

                <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-extrabold uppercase leading-tight tracking-[-0.01em] text-white">
                      {source.name}
                    </p>
                    <p className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white/55">
                      {source.count > 0 ? `${formatCompactNumber(source.count)} scenes` : 'awaiting first sync'}
                    </p>
                  </div>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-sm transition-colors group-hover/card:border-primary group-hover/card:text-primary">
                    <ArrowUpRight className="size-4" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
