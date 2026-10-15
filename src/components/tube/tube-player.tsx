import { ExternalLink, MonitorPlay } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TubeVideo } from '@/lib/tube/models';

const PLAYER_SHELL = 'relative isolate aspect-video w-full overflow-hidden rounded-card bg-black';

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
        {video.embedType === 'iframe' ? 'Publisher player' : video.embedType === 'video' ? 'Source CDN file' : 'Link only'}
      </Badge>
      <span>
        Plays from {video.sourceName}
        {video.embedType === 'link' ? ' (no embed available)' : ''} — never re-hosted by us.
      </span>
    </div>
  );
}
