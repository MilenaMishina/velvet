import { ExternalLink } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { ChannelAvatar } from '@/components/video/channel-avatar';
import { formatCompactNumber, formatSubscribers } from '@/lib/format';
import type { AppChannel } from '@/lib/youtube/models';

/**
 * Channel hero: banner, avatar, counts and the creator's own description.
 *
 * The banner URL comes straight from YouTube's CDN — like every image in this app
 * it is displayed, never copied or re-hosted.
 */
export function ChannelHeader({ channel }: { channel: AppChannel }) {
  return (
    <section className="panel overflow-hidden rounded-card shadow-card">
      {channel.bannerUrl ? (
        <div className="relative aspect-[6/1] w-full bg-surface-sunken">
          <Image
            // YouTube serves banners sized by suffix; without one the URL 404s.
            src={`${channel.bannerUrl}=w2560`}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" />
        </div>
      ) : (
        <div aria-hidden className="brand-gradient h-24 w-full opacity-70 sm:h-32" />
      )}

      <div className="flex flex-wrap items-start gap-5 p-5 sm:p-6">
        <ChannelAvatar channel={channel} size="xl" className="-mt-12 ring-4 ring-surface sm:-mt-14" />

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h1 className="font-display text-xl font-bold tracking-[-0.02em] sm:text-2xl">{channel.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted">
              {channel.handle ? <span className="font-medium text-foreground">{channel.handle}</span> : null}
              <span>{formatSubscribers(channel.subscriberCount, channel.subscriberCountHidden)}</span>
              {channel.videoCount !== null ? <span>{formatCompactNumber(channel.videoCount)} videos</span> : null}
              {channel.viewCount !== null ? <span>{formatCompactNumber(channel.viewCount)} total views</span> : null}
            </p>
          </div>

          {channel.description ? (
            <p className="line-clamp-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
              {channel.description}
            </p>
          ) : null}
        </div>

        <Button variant="outline" size="md" pill asChild className="shrink-0">
          <a href={channel.channelUrl} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden />
            Subscribe on YouTube
          </a>
        </Button>
      </div>
    </section>
  );
}
