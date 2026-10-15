'use client';

import { BookmarkPlus, Heart, History, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { DegradedNotice } from '@/components/feedback/degraded-notice';
import { EmptyState } from '@/components/feedback/empty-state';
import { useLibrary } from '@/components/providers/library-provider';
import { Button } from '@/components/ui/button';
import { VideoGrid } from '@/components/video/video-grid';
import { VideoGridSkeleton } from '@/components/video/video-grid-skeleton';
import { fetchVideosByIds } from '@/lib/api/client';
import { chunk } from '@/lib/utils';
import type { LibraryList } from '@/lib/library/storage';
import type { AppVideo, ResponseMeta } from '@/lib/youtube/models';
import { routes } from '@/lib/routes';

const COPY: Record<LibraryList, { title: string; description: string; icon: typeof Heart }> = {
  watchLater: {
    title: 'Nothing saved for later yet',
    description: 'Tap the bookmark on any video card to queue it up here.',
    icon: BookmarkPlus,
  },
  favorites: {
    title: 'No favorites yet',
    description: 'Tap the heart on a video card to keep it close.',
    icon: Heart,
  },
  history: {
    title: 'No watch history yet',
    description: 'Videos you open appear here. History is stored in this browser only.',
    icon: History,
  },
};

/**
 * Renders one saved list.
 *
 * Only ids are stored locally, so this hydrates them through our proxy in batches
 * of 50 — one quota unit per batch — and drops ids YouTube no longer serves, which
 * keeps deleted videos from lingering as broken cards.
 */
export function LibraryShelf({ list }: { list: LibraryList }) {
  const library = useLibrary();
  const saved = library[list];
  const ids = React.useMemo(() => saved.map((item) => item.id), [saved]);
  const idKey = ids.join(',');

  const [videos, setVideos] = React.useState<AppVideo[]>([]);
  const [meta, setMeta] = React.useState<ResponseMeta | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!library.ready) return;
    if (ids.length === 0) {
      setVideos([]);
      setMeta(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const batches = chunk(ids, 50);
        const results = await Promise.all(batches.map((batch) => fetchVideosByIds(batch, controller.signal)));
        if (controller.signal.aborted) return;

        const byId = new Map<string, AppVideo>();
        for (const result of results) {
          for (const video of result.page.items) byId.set(video.id, video);
        }
        // Preserve the saved order (newest first) rather than the API's.
        setVideos(ids.map((id) => byId.get(id)).filter((video): video is AppVideo => Boolean(video)));
        setMeta(results.at(-1)?.meta ?? null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Could not load your saved videos.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
    // `idKey` is the stable identity of the id list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, library.ready]);

  if (!library.ready || (loading && videos.length === 0)) {
    return <VideoGridSkeleton count={8} />;
  }

  if (ids.length === 0) {
    const copy = COPY[list];
    return (
      <EmptyState
        icon={copy.icon}
        title={copy.title}
        description={copy.description}
        action={
          <Button variant="primary" size="md" pill asChild>
            <Link href={routes.home}>Browse the feed</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <DegradedNotice meta={meta} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-foreground-subtle">
          {videos.length} of {ids.length} saved {ids.length === 1 ? 'video' : 'videos'} still available on YouTube
        </p>
        <Button variant="danger" size="sm" pill onClick={() => library.clear(list)}>
          <Trash2 aria-hidden />
          Clear list
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {videos.length > 0 ? (
        <VideoGrid videos={videos} />
      ) : !loading ? (
        <EmptyState
          title="These saves are no longer available"
          description="Every video in this list has been made private or removed on YouTube."
          action={
            <Button variant="outline" size="sm" pill onClick={() => library.clear(list)}>
              Clear the list
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
