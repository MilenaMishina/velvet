import { ExternalLink, Globe2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdBanner, AdLeadStrip } from '@/components/ads/ad-banner';
import { PageHeader, SectionHeading } from '@/components/layout/page-header';
import { TubeGrid } from '@/components/tube/tube-grid';
import { TubePlayer, TubePlayerMeta } from '@/components/tube/tube-player';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAbsoluteDate, formatDuration, formatRelativeTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import { getRelatedVideos, getVideoById, listComments } from '@/lib/tube/db';
import { VideoComments } from '@/components/tube/video-comments';
import { ViewBeacon } from '@/components/tube/view-beacon';
import { cn } from '@/lib/utils';

/** Local database state per request — see the index page for the same reasoning. */
export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const video = getVideoById(params.id);
  if (!video) return { title: 'Video not found' };
  return {
    title: video.title || 'Indexed video',
    description: video.description ?? `Indexed from ${video.sourceName}.`,
  };
}

/**
 * Play page for an indexed video.
 *
 * Everything except the player shell is metadata we hold locally. The player is
 * the publisher's own (see `TubePlayer`), and the original page is always linked so
 * the visitor can reach the source and its creator directly.
 */
export default async function SourceVideoPage({ params }: { params: { id: string } }) {
  const video = getVideoById(params.id);
  if (!video) notFound();

  // The view is counted by `ViewBeacon` on the client, at most once per viewer per
  // day. Counting during render would mean a reload — or a prefetch — votes again.
  const related = getRelatedVideos(video, 12);
  const comments = await listComments(video.id);
  const posted = video.publishedAt ?? video.scrapedAt;

  return (
    <div className="space-y-8">
      <AdLeadStrip />

      <TubePlayer video={video} />
      <TubePlayerMeta video={video} />

      {/* Full-width unit between the player and the metadata: the visitor has
          already committed to this video, so it interrupts nothing. */}
      <AdBanner size="billboard" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <PageHeader
            eyebrow={
              <>
                <Globe2 className="size-3.5" aria-hidden />
                Indexed from {video.sourceName}
              </>
            }
            title={video.title || 'Untitled'}
            description={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-subtle">
                {posted ? <span>{formatRelativeTime(posted)}</span> : null}
                {video.durationSeconds ? <span>• {formatDuration(video.durationSeconds)} long</span> : null}
                <span>• Indexed {formatAbsoluteDate(video.scrapedAt)}</span>
                <span aria-hidden>•</span>
                <ViewBeacon videoId={video.id} initialViews={video.views} />
              </span>
            }
            actions={
              <Button asChild variant="outline" size="sm" pill>
                <a href={video.pageUrl} target="_blank" rel="noopener noreferrer nofollow">
                  Open original
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            }
          />

          {video.description ? (
            <div className="panel rounded-card p-4">
              <h2 className="pb-2 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
                Description (from the source page)
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground-muted">
                {video.description}
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            <h2 className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Provenance</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="panel rounded-card p-3">
                <dt className="text-2xs uppercase tracking-wider text-foreground-subtle">Source</dt>
                <dd className="pt-1 text-sm font-medium">
                  <Link
                    href={routes.tube.filtered({ source: video.sourceId })}
                    className="transition-colors hover:text-primary"
                  >
                    {video.sourceName}
                  </Link>
                </dd>
              </div>
              <div className="panel min-w-0 rounded-card p-3">
                <dt className="text-2xs uppercase tracking-wider text-foreground-subtle">Original page</dt>
                <dd className="pt-1 text-sm">
                  <a
                    href={video.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="block truncate text-primary transition-colors hover:underline"
                  >
                    {video.pageUrl}
                  </a>
                </dd>
              </div>
            </dl>

            {video.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {video.tags.map((tag) => (
                  <li key={tag}>
                    <Badge tone="neutral">{tag}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <VideoComments videoId={video.id} initialComments={comments} />
        </div>

        <aside className={cn('min-w-0 space-y-4')}>
          <AdBanner size="rectangle" />

          <SectionHeading
            title="More from this source"
            description={related.length > 0 ? `${related.length} indexed nearby` : undefined}
          />
          {related.length > 0 ? (
            <TubeGrid videos={related} layout="columns-1 gap-x-4 sm:columns-2 lg:columns-1 2xl:columns-2" />
          ) : (
            <p className="panel rounded-card p-4 text-sm text-foreground-muted">
              Nothing else indexed from {video.sourceName} yet.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
