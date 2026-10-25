import { Clock, ExternalLink, Eye, Globe2, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdLeadStrip, AdSlot } from '@/components/ads/ad-slot';
import { AdNative } from '@/components/ads/ad-native';
import { SectionHeading } from '@/components/layout/page-header';
import { HistoryRecorder } from '@/components/tube/history-recorder';
import { TubeRow } from '@/components/tube/tube-grid';
import { TubePlayer } from '@/components/tube/tube-player';
import { VideoComments } from '@/components/tube/video-comments';
import { ViewBeacon } from '@/components/tube/view-beacon';
import { Button } from '@/components/ui/button';
import { formatDuration, formatRelativeTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import { getRelatedVideos, getVideoById, listComments } from '@/lib/tube/db';
import { resolveVideoPlayer } from '@/lib/tube/resolve';

/** Local database state per request — the catalogue changes on every sync. */
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
 * Player first, then a tight title row with the stats everyone expects (views,
 * date, duration), then provenance as quiet chips instead of a panel farm, then
 * comments, with the related rail and its ad units staying in the sidebar.
 */
export default async function SourceVideoPage({ params }: { params: { id: string } }) {
  const stored = getVideoById(params.id);
  if (!stored) notFound();

  // Nothing playable was stored for this row: read the source page once on the
  // visitor's behalf and keep whatever it now offers, so the next visit is instant.
  // Bounded and rate-limited inside the resolver, so a page that is permanently
  // challenged costs one request per window rather than one per visit.
  const resolved = stored.embedType === 'link' ? await resolveVideoPlayer(stored) : null;
  const video = resolved?.video ?? stored;

  // The view is counted by `ViewBeacon` on the client, at most once per viewer per
  // day. Counting during render would mean a reload — or a prefetch — votes again.
  const related = getRelatedVideos(video, 12);
  const comments = await listComments(video.id);
  const posted = video.publishedAt ?? video.scrapedAt;

  return (
    <div className="space-y-8">
      <HistoryRecorder
        entry={{
          id: video.id,
          title: video.title || 'Untitled',
          thumbnailUrl: video.thumbnailUrl,
          sourceName: video.sourceName,
          sourceId: video.sourceId,
          durationSeconds: video.durationSeconds,
          views: video.views,
          pageUrl: video.pageUrl,
        }}
      />
      <AdLeadStrip />

      {/* ── The player ────────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl">
        {/* The house glow frames the screen as the centrepiece the way a cinema screen does. */}
        <div className="overflow-hidden rounded-card ring-1 ring-primary/25 [box-shadow:var(--shadow-lifted),0_0_70px_-24px_hsl(var(--primary)/0.4)]">
          <TubePlayer video={video} />
        </div>
      </div>

      {/* ── Title row ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <h1 className="font-display text-xl font-bold leading-snug tracking-[-0.02em] text-pretty sm:text-2xl">
            {video.title || 'Untitled'}
          </h1>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-muted">
            <li className="inline-flex items-center gap-1.5">
              <Eye className="size-3.5 text-foreground-subtle" aria-hidden />
              <ViewBeacon videoId={video.id} initialViews={video.views} />
            </li>
            {posted ? (
              <li className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-foreground-subtle" aria-hidden />
                {formatRelativeTime(posted)}
              </li>
            ) : null}
            {video.durationSeconds ? (
              <li>{formatDuration(video.durationSeconds)}</li>
            ) : null}
            <li>
              <Link
                href={routes.tube.filtered({ source: video.sourceId })}
                className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-primary"
              >
                <Globe2 className="size-3.5 text-foreground-subtle" aria-hidden />
                {video.sourceName}
              </Link>
            </li>
            <li>
              <a
                href={video.pageUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-foreground-subtle underline-offset-2 transition-colors hover:text-primary hover:underline"
              >
                original page
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          </ul>
        </div>

        <Button asChild variant="outline" size="md" pill className="shrink-0">
          <a href={video.pageUrl} target="_blank" rel="noopener noreferrer nofollow">
            Watch on {video.sourceName}
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </div>

      {/* Tags as live filters into the feed. */}
      {video.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {video.tags.slice(0, 12).map((tag) => (
            <li key={tag}>
              <Link href={routes.tube.tag(tag)} className="chip !px-3 !py-1 !text-2xs">
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Full-width unit between the metadata and the comments: the visitor has
          already committed to this video, so it interrupts nothing. */}
      <AdSlot placement="watch-billboard" />

      {video.description ? (
        <div className="panel rounded-card p-5">
          <h2 className="pb-2 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
            Description (from the source page)
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground-muted">{video.description}</p>
        </div>
      ) : null}

      {/* ── Comments + related rail ──────────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <SectionHeading
            title={
              <span className="inline-flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" aria-hidden />
                Comments
              </span>
            }
            description={comments.length > 0 ? `${comments.length} so far` : undefined}
          />
          <VideoComments videoId={video.id} initialComments={comments} />

          <AdNative />
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <AdSlot placement="watch-rectangle" />

          {related.length > 0 ? (
            <>
              <SectionHeading title="More like this" />
              <div className="flex flex-col gap-3">
                {related.map((video) => (
                  <TubeRow key={video.id} video={video} />
                ))}
              </div>
            </>
          ) : null}

          <AdSlot placement="watch-promo" />
        </aside>
      </div>
    </div>
  );
}
