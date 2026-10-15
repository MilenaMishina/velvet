'use client';

import { Check, ExternalLink, Share2, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ChannelAvatar } from '@/components/video/channel-avatar';
import { LibraryToggle } from '@/components/video/library-toggle';
import { formatCompactNumber, formatSubscribers } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { AppChannel, AppVideo } from '@/lib/youtube/models';

/**
 * Watch-page action row.
 *
 * Note what is *not* here: there is no like or subscribe button. Both require
 * OAuth write scopes we deliberately don't request, so instead we link out to the
 * canonical YouTube page where those actions belong — which also keeps creator
 * attribution front and centre.
 */
export function WatchActions({ video, channel }: { video: AppVideo; channel: AppChannel | null }) {
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const share = async () => {
    const url = `${window.location.origin}${routes.watch(video.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      resetTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* Cancelled share sheet or denied clipboard — nothing to recover from. */
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={routes.channel(video.channel.id)} aria-label={video.channel.title} className="rounded-full">
          <ChannelAvatar channel={{ ...video.channel, avatarUrl: channel?.avatarUrl ?? video.channel.avatarUrl }} size="lg" />
        </Link>
        <div className="min-w-0">
          <Link
            href={routes.channel(video.channel.id)}
            className="block truncate font-display text-sm font-semibold tracking-tight hover:text-primary"
          >
            {channel?.title ?? video.channel.title}
          </Link>
          <p className="mt-0.5 text-xs text-foreground-subtle">
            {channel ? formatSubscribers(channel.subscriberCount, channel.subscriberCountHidden) : 'Channel details unavailable'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {video.likeCount !== null ? (
          <span className="flex items-center gap-1.5 rounded-pill bg-surface-raised/70 px-3.5 py-2 text-sm font-medium text-foreground-muted">
            <ThumbsUp className="size-4" aria-hidden />
            {formatCompactNumber(video.likeCount)}
            <span className="sr-only">likes on YouTube</span>
          </span>
        ) : null}

        <LibraryToggle list="watchLater" videoId={video.id} appearance="inline" />
        <LibraryToggle list="favorites" videoId={video.id} appearance="inline" />

        <Button variant="outline" size="md" pill onClick={share} aria-label="Share this video">
          {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
          <span className="hidden sm:inline">{copied ? 'Link copied' : 'Share'}</span>
        </Button>

        <Button variant="ghost" size="md" pill asChild>
          <a href={video.watchUrl} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden />
            <span className="hidden sm:inline">Open on YouTube</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
