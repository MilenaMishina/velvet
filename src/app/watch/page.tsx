import { Film } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DegradedNotice } from '@/components/feedback/degraded-notice';
import { EmptyState } from '@/components/feedback/empty-state';
import { SetupNotice } from '@/components/feedback/setup-notice';
import { SectionHeading } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { VideoList } from '@/components/video/video-grid';
import { Player } from '@/components/watch/player';
import { VideoDescription } from '@/components/watch/video-description';
import { WatchActions } from '@/components/watch/watch-actions';
import { parseVideoId } from '@/lib/api/params';
import { loadFeed, loadResource } from '@/lib/api/server-feed';
import { isYouTubeConfigured } from '@/lib/env';
import { formatRelativeTime } from '@/lib/format';
import { labelForCategoryId } from '@/lib/youtube/categories';
import { isYouTubeApiError } from '@/lib/youtube/errors';
import { getRelatedVideos, getWatchData } from '@/lib/youtube/service';

interface WatchPageProps {
  searchParams: { v?: string };
}

export async function generateMetadata({ searchParams }: WatchPageProps): Promise<Metadata> {
  const videoId = parseVideoId(searchParams.v);
  if (!videoId) return { title: 'Watch' };

  const result = await loadResource(() => getWatchData(videoId)).catch(() => null);
  const video = result?.data?.video;
  if (!video) return { title: 'Watch' };

  return {
    title: video.title,
    description: video.teaser || `Watch ${video.title} by ${video.channel.title}.`,
    openGraph: {
      title: video.title,
      description: video.teaser,
      images: video.thumbnail.url ? [{ url: video.thumbnail.url }] : undefined,
      type: 'video.other',
    },
    // Point crawlers at the creator's own page, not our mirror of the metadata.
    alternates: { canonical: video.watchUrl },
  };
}

/**
 * Watch page.
 *
 * Two 1-unit calls when cold (the video and its channel), zero when the visitor
 * arrived from a feed — feed responses prime the per-video cache. Playback is the
 * official IFrame embed; the "More like this" rail is rebuilt from cheap signals
 * because YouTube removed `relatedToVideoId`.
 */
export default async function WatchPage({ searchParams }: WatchPageProps) {
  const videoId = parseVideoId(searchParams.v);
  if (!videoId) notFound();
  if (!isYouTubeConfigured) return <SetupNotice />;

  const watch = await loadResource(() => getWatchData(videoId)).catch((error: unknown) => {
    // A removed or private video is a 404 for us, not a server error.
    if (isYouTubeApiError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  });
  if (!watch.data) {
    return (
      <div className="space-y-6">
        <DegradedNotice meta={watch.meta} />
        <EmptyState
          icon={Film}
          title="This video can’t be loaded right now"
          description="YouTube didn’t return details for it. It may be private, removed, or we’ve hit today’s API budget."
        />
      </div>
    );
  }

  const { video, channel } = watch.data;
  const related = await loadFeed(() => getRelatedVideos(videoId));
  const categoryLabel = labelForCategoryId(video.categoryId);
  const published = formatRelativeTime(video.publishedAt);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="min-w-0 space-y-5">
        <Player videoId={video.id} title={video.title} />

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {video.isLive ? <Badge tone="live">Live now</Badge> : null}
              {categoryLabel ? <Badge tone="primary">{categoryLabel}</Badge> : null}
              {published ? (
                <span className="text-2xs font-medium uppercase tracking-wider text-foreground-subtle" suppressHydrationWarning>
                  {published}
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-xl font-bold leading-snug tracking-[-0.02em] text-pretty sm:text-2xl">
              {video.title}
            </h1>
          </div>

          <WatchActions video={video} channel={channel} />
        </div>

        <DegradedNotice meta={watch.meta} />
        <VideoDescription video={video} />
      </div>

      <aside aria-label="More like this" className="min-w-0 space-y-4">
        <SectionHeading
          title="More like this"
          description={
            related.items.length > 0
              ? 'Built from this creator’s uploads, the same category, and tag similarity.'
              : undefined
          }
        />
        <DegradedNotice meta={related.meta} />
        {related.items.length > 0 ? (
          <VideoList videos={related.items} />
        ) : (
          <EmptyState
            icon={Film}
            title="No recommendations yet"
            description="We couldn’t assemble a rail for this video without spending more API quota than it’s worth."
            className="py-10"
          />
        )}
      </aside>
    </div>
  );
}
