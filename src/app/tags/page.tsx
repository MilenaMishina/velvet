import { ArrowUpRight, Tags } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader, SectionHeading } from '@/components/layout/page-header';
import { formatCompactNumber } from '@/lib/format';
import { routes } from '@/lib/routes';
import { listSourcesWithCounts, topTags } from '@/lib/tube/db';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Tags',
  description: 'Every tag in the catalogue, ranked by how much content carries it.',
};

/** The database changes on every sync — never prerender it at build time. */
export const dynamic = 'force-dynamic';

/** The five visual steps of the cloud: the head of the distribution is bigger. */
const CAP_STEP = 10;

function capClass(index: number): string {
  if (index < CAP_STEP) return 'text-base px-4 py-2';
  if (index < CAP_STEP * 2) return 'text-sm px-3.5 py-1.5';
  if (index < CAP_STEP * 4) return 'text-xs px-3 py-1.5';
  return 'text-2xs px-2.5 py-1';
}

/**
 * The tag cloud.
 *
 * The cloud shows rank, not raw counts (which mean nothing to a visitor): tags
 * toward the head of the distribution render larger, everything tails off, so the
 * page has a shape instead of being a flat wall of pills. Each tag is a live
 * filter into the feed.
 */
export default function TagsPage() {
  const tags = topTags(72);
  const sources = listSourcesWithCounts().filter((source) => source.count > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <Tags className="size-3.5" aria-hidden />
            {tags.length} tags in the catalogue
          </>
        }
        title="Explore by tag"
        description="Ranked by how much content carries each one. Pick a tag to filter the whole feed down to it."
      />

      {tags.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No tags yet"
          description="Tags arrive with the sync — most source pages label their scenes. Run a sync, then reload."
        />
      ) : (
        <ul className={cn('flex flex-wrap items-center gap-2.5')}>
          {tags.map((tag, index) => (
            <li key={tag}>
              <Link href={routes.tube.tag(tag)} className={cn('chip hover:!text-primary', capClass(index))}>
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* A tag page with a thin cloud still has to lead somewhere: the studios are
          the other axis of the catalogue, so they close the page. */}
      {sources.length > 0 ? (
        <section className="space-y-3.5">
          <SectionHeading
            title="Browse by studio"
            actions={
              <Link
                href={routes.sources}
                className="inline-flex items-center gap-0.5 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-foreground-subtle transition-colors hover:text-primary"
              >
                All studios
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {sources.map((source) => (
              <li key={source.id}>
                <Link
                  href={routes.tube.filtered({ source: source.id })}
                  className="panel flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-300 ease-spring hover:border-primary/40 hover:shadow-card"
                >
                  <span className="heat-gradient grid size-8 shrink-0 place-items-center rounded-md font-display text-[0.7rem] font-extrabold uppercase text-primary-foreground">
                    {source.name.slice(0, 2)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.78rem] font-medium">{source.name}</span>
                    <span className="block text-[0.62rem] font-bold uppercase tracking-[0.06em] text-foreground-subtle">
                      {formatCompactNumber(source.count)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
