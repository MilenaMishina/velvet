import { ListVideo, VideoOff } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ChannelHeader } from '@/components/channel/channel-header';
import { PlaylistGrid } from '@/components/channel/playlist-grid';
import { DegradedNotice } from '@/components/feedback/degraded-notice';
import { EmptyState } from '@/components/feedback/empty-state';
import { SetupNotice } from '@/components/feedback/setup-notice';
import { TabLinks } from '@/components/layout/tab-links';
import { InfiniteVideoFeed } from '@/components/video/infinite-video-feed';
import { parseChannelRef } from '@/lib/api/params';
import { loadFeed, loadResource } from '@/lib/api/server-feed';
import { isYouTubeConfigured } from '@/lib/env';
import { toTeaser } from '@/lib/format';
import { isYouTubeApiError } from '@/lib/youtube/errors';
import { getChannel, getChannelPlaylists, getChannelUploads } from '@/lib/youtube/service';

interface ChannelPageProps {
  params: { id: string };
  searchParams: { tab?: string };
}

/** Uploads and subscriber counts move constantly — render per request. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: ChannelPageProps): Promise<Metadata> {
  const ref = parseChannelRef(params.id);
  if (!ref) return { title: 'Channel' };

  const result = await loadResource(() => getChannel(ref)).catch(() => null);
  const channel = result?.data;
  if (!channel) return { title: 'Channel' };

  return {
    title: channel.title,
    description: toTeaser(channel.description, 160) || `Videos from ${channel.title}.`,
    alternates: { canonical: channel.channelUrl },
  };
}

/**
 * Channel page.
 *
 * Uploads are read from the channel's uploads playlist (2 units/page) rather than
 * a channel-scoped search (100 units). Handles (`@creator`) are resolved through
 * `channels.list?forHandle`, which is also 1 unit.
 */
export default async function ChannelPage({ params, searchParams }: ChannelPageProps) {
  const ref = parseChannelRef(params.id);
  if (!ref) notFound();
  if (!isYouTubeConfigured) return <SetupNotice />;

  const result = await loadResource(() => getChannel(ref)).catch((error: unknown) => {
    if (isYouTubeApiError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  });

  if (!result.data) {
    return (
      <div className="space-y-6">
        <DegradedNotice meta={result.meta} />
        <EmptyState
          icon={VideoOff}
          title="Channel details unavailable"
          description="YouTube didn’t return this channel. It may have been removed, or we’ve reached today’s API budget."
        />
      </div>
    );
  }

  const channel = result.data;
  const tab = searchParams.tab === 'playlists' ? 'playlists' : 'videos';
  const basePath = `/channel/${encodeURIComponent(params.id)}`;

  const [uploads, playlists] = await Promise.all([
    tab === 'videos' ? loadFeed(() => getChannelUploads(channel.id, { maxResults: 24 })) : null,
    tab === 'playlists'
      ? getChannelPlaylists(channel.id, { maxResults: 30 })
          .then((page) => page.data.items)
          .catch(() => [])
      : null,
  ]);

  return (
    <div className="space-y-7">
      <ChannelHeader channel={channel} />

      <TabLinks
        tabs={[
          { label: 'Videos', href: basePath, active: tab === 'videos', count: channel.videoCount },
          { label: 'Playlists', href: `${basePath}?tab=playlists`, active: tab === 'playlists' },
        ]}
      />

      {tab === 'videos' && uploads ? (
        <InfiniteVideoFeed
          source={{ kind: 'channel', channelId: channel.id }}
          initialItems={uploads.items}
          initialPageToken={uploads.nextPageToken}
          initialMeta={uploads.meta}
          showChannel={false}
          emptyState={
            <EmptyState
              icon={VideoOff}
              title="No public uploads"
              description="This channel hasn’t published any videos we can embed."
            />
          }
        />
      ) : null}

      {tab === 'playlists' ? (
        playlists && playlists.length > 0 ? (
          <PlaylistGrid playlists={playlists} />
        ) : (
          <EmptyState
            icon={ListVideo}
            title="No public playlists"
            description="This channel hasn’t shared any playlists."
          />
        )
      ) : null}
    </div>
  );
}
