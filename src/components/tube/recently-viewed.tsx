'use client';

import { History, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { SectionHeading } from '@/components/layout/page-header';
import { formatCompactNumber, formatDuration } from '@/lib/format';
import { routes } from '@/lib/routes';
import { clearHistory, readHistory, type HistoryEntry } from '@/lib/watch-history';

/**
 * "Continue watching".
 *
 * Rendered only after mount, because the entries live in localStorage: rendering
 * them on the server is impossible and guessing would cause the very hydration
 * mismatch this site just spent a pass removing. A visitor with no history sees
 * nothing at all — no empty shelf, no explainer.
 */
export function RecentlyViewed() {
  const [items, setItems] = React.useState<HistoryEntry[]>([]);

  React.useEffect(() => setItems(readHistory()), []);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading" className="space-y-3.5">
      <SectionHeading
        title={
          <span id="recent-heading" className="inline-flex items-center gap-2">
            <History className="size-4 text-primary" aria-hidden />
            Continue watching
          </span>
        }
        actions={
          <button
            type="button"
            onClick={() => {
              clearHistory();
              setItems([]);
            }}
            className="inline-flex items-center gap-1 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-foreground-subtle transition-colors hover:text-primary"
          >
            <Trash2 className="size-3" aria-hidden />
            Clear
          </button>
        }
      />
      <div className="rail">
        {items.map((item) => {
          const duration = formatDuration(item.durationSeconds);
          return (
            <article key={item.id} className="group/card">
              <Link
                href={routes.tube.watch(item.id)}
                className="relative block aspect-video overflow-hidden rounded-lg bg-surface-sunken ring-1 ring-white/[0.06]"
              >
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote posters are unoptimized by design
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-500 ease-out-quint group-hover/card:scale-[1.04]"
                  />
                ) : null}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
                {duration ? (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/85 px-1.5 py-0.5 text-[0.68rem] font-bold tabular-nums text-white">
                    {duration}
                  </span>
                ) : null}
              </Link>
              <Link
                href={routes.tube.watch(item.id)}
                className="mt-2 line-clamp-2 block text-[0.82rem] font-medium leading-[1.35] transition-colors hover:text-primary"
              >
                {item.title}
              </Link>
              <p className="mt-1 flex items-center gap-1.5 text-[0.68rem] text-foreground-subtle">
                <span className="font-bold uppercase tracking-[0.06em] text-primary/80">{item.sourceName}</span>
                {item.views > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{formatCompactNumber(item.views)} views</span>
                  </>
                ) : null}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
