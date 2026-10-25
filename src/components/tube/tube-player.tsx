'use client';

import Image from 'next/image';
import { ExternalLink, Images, MonitorPlay } from 'lucide-react';
import * as React from 'react';

import { AdInVideo } from '@/components/ads/ad-invideo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TubeVideo } from '@/lib/tube/models';

const PLAYER_SHELL = 'relative isolate aspect-video w-full overflow-hidden rounded-card bg-black';

/**
 * Photo set viewer for embed_type 'gallery' — the post carried no video at all.
 * The first shot fills the frame; the rest ride a filmstrip below the stage.
 */
function GalleryViewer({ video }: { video: TubeVideo }) {
  const shots = [video.thumbnailUrl, ...video.galleryUrls].filter(
    (url): url is string => typeof url === 'string' && url.length > 0,
  );
  const [active, setActive] = React.useState(0);
  // `shots.length > 0` is guaranteed past the early return above.
  const current = shots[Math.min(active, shots.length - 1)] as string;

  if (shots.length === 0) {
    return (
      <div className={PLAYER_SHELL}>
        <div className="absolute inset-0 grid place-items-center gap-3 text-center">
          <div className="space-y-2">
            <Images className="mx-auto size-8 text-foreground-subtle" aria-hidden />
            <p className="text-sm text-foreground-muted">This photo set has no images stored.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={PLAYER_SHELL}>
        <Image
          src={current}
          alt={video.title || 'Photo'}
          fill
          unoptimized
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="absolute inset-0 object-contain"
        />
        <span className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-black/85 px-2 py-0.5 text-[0.68rem] font-bold tabular-nums text-white">
          {active + 1} / {shots.length}
        </span>
      </div>

      {shots.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {shots.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Photo ${index + 1} of ${shots.length}`}
              aria-current={index === active}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md ring-1 transition-opacity ${
                index === active ? 'ring-2 ring-primary' : 'ring-white/10 opacity-60 hover:opacity-100'
              }`}
            >
              <Image src={url} alt="" fill unoptimized sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Play surface for an indexed video.
 *
 * Three modes, decided by what the sync actually found on the source page:
 *
 *  - `iframe` — the publisher's own player page is framed directly.
 *  - `video`  — the publisher's CDN file is played by the browser's native player.
 *  - `link`   — nothing embeddable was published (or the page was bot-protected),
 *               so we hand the visitor off to the original page instead of
 *               pretending we can play it.
 *
 * In every mode the media stays on the source's infrastructure: we never download,
 * transcode, cache or proxy the stream.
 */
export function TubePlayer({ video }: { video: TubeVideo }) {
  const { embedUrl, embedType } = video;

  if (embedType === 'gallery') {
    return <GalleryViewer video={video} />;
  }

  if (embedType === 'iframe' && embedUrl) {
    return (
      <div className={PLAYER_SHELL}>
        <iframe
          src={embedUrl}
          title={video.title || 'Video player'}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 size-full border-0"
        />
        <AdInVideo />
      </div>
    );
  }

  if (embedType === 'video' && embedUrl) {
    return (
      <div className={PLAYER_SHELL}>
        <video
          src={embedUrl}
          poster={video.thumbnailUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full"
        />
        <AdInVideo />
      </div>
    );
  }

  return (
    <div className="panel flex aspect-video flex-col items-center justify-center gap-4 rounded-card px-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-raised text-foreground-muted">
        <MonitorPlay className="size-5" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-base font-semibold tracking-tight">No embeddable player found</p>
        <p className="mx-auto max-w-md text-sm text-foreground-muted">
          The source page did not expose a frameable player we can use — often because it sits behind a bot
          challenge. The original page is one click away.
        </p>
      </div>
      <Button asChild variant="outline" size="md" pill>
        <a href={video.pageUrl} target="_blank" rel="noopener noreferrer nofollow">
          Open on {video.sourceName}
          <ExternalLink aria-hidden />
        </a>
      </Button>
    </div>
  );
}

/** Small provenance strip under the player: where this plays from, and its state. */
export function TubePlayerMeta({ video }: { video: TubeVideo }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-subtle">
      <Badge tone={video.embedType === 'link' ? 'warning' : 'primary'}>
        {video.embedType === 'iframe'
          ? 'Publisher player'
          : video.embedType === 'video'
            ? 'Source CDN file'
            : video.embedType === 'gallery'
              ? 'Photo set'
              : 'Link only'}
      </Badge>
      <span>
        Plays from {video.sourceName}
        {video.embedType === 'link' ? ' (no embed available)' : ''} — never re-hosted by us.
      </span>
    </div>
  );
}
