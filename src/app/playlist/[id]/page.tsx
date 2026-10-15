import { ExternalLink, ListVideo } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DegradedNotice } from '@/components/feedback/degraded-notice';
import { EmptyState } from '@/components/feedback/empty-state';
import { SetupNotice } from '@/components/feedback/setup-notice';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { InfiniteVideoFeed } from '@/components/video/infinite-video-feed';
import { parsePlaylistId } from '@/lib/api/params';
import { loadFeed, loadResource } from '@/lib/api/server-feed';
import { isYouTubeConfigured } from '@/lib/env';
import { formatCompactNumber, toTeaser } from '@/lib/format';
import { routes } from '@/lib/routes';
import { isYouTubeApiError } from '@/lib/youtube/errors';
import { getPlaylist, getPlaylistVideos } from '@/lib/youtube/service';

interface PlaylistPageProps {
  params: { id: string };
}

/** Playlists gain and lose videos, so this is always rendered per request. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PlaylistPageProps): Promise<Metadata> {
  const playlistId = parsePlaylistId(params.id);
  if (!playlistId) return { title: 'Playlist' };

  const result = await loadResource(() => getPlaylist(playlistId)).catch(() => null);
  const playlist = result?.data;
  if (!playlist) return { title: 'Playlist' };

  return {
    title: playlist.title,
    description: toTeaser(playlist.description, 160) || `A playlist from ${playlist.channel.title}.`,
    alternates: { canonical: playlist.playlistUrl },
  };
}

/** Playlist page — metadata plus a paginated grid of its videos (1 unit per page). */
export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const playlistId = parsePlaylistId(params.id);
  if (!playlistId) notFound();
  if (!isYouTubeConfigured) return <SetupNotice />;

  const result = await loadResource(() => getPlaylist(playlistId)).catch((error: unknown) => {
    if (isYouTubeApiError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  });

  const playlist = result.data;
  const feed = await loadFeed(() => getPlaylistVideos(playlistId, { maxResults: 24 }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <ListVideo className="size-3.5" aria-hidden />
            Playlist
          </>
        }
        title={playlist?.title ?? 'Playlist'}
        description={
          playlist
            ? [
                playlist.channel.title ? `Curated by ${playlist.channel.title}` : null,
                playlist.itemCount !== null ? `${formatCompactNumber(playlist.itemCount)} videos` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        actions={
          playlist ? (
            <>
              {playlist.channel.id ? (
                <Button variant="outline" size="md" pill asChild>
                  <Link href={routes.channel(playlist.channel.id)}>View channel</Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="md" pill asChild>
                <a href={playlist.playlistUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink aria-hidden />
                  On YouTube
                </a>
              </Button>
            </>
          ) : undefined
        }
      />

      <DegradedNotice meta={result.meta} />

      <InfiniteVideoFeed
        source={{ kind: 'playlist', playlistId }}
        initialItems={feed.items}
        initialPageToken={feed.nextPageToken}
        initialMeta={feed.meta}
        emptyState={
          <EmptyState
            icon={ListVideo}
            title="This playlist is empty"
            description="Every video in it is private, deleted, or not embeddable."
          />
        }
      />
    </div>
  );
}
