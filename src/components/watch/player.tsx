'use client';

import * as React from 'react';

import { useLibrary } from '@/components/providers/library-provider';
import { buildEmbedUrl, EMBED_IFRAME_PROPS } from '@/lib/youtube/embed';
import { cn } from '@/lib/utils';

export interface PlayerProps {
  videoId: string;
  title: string;
  className?: string;
}

/**
 * The watch-page player.
 *
 * Playback is 100% YouTube's official IFrame embed — we never touch a media
 * stream, and the creator keeps their impressions, ads and analytics. Mounting
 * also records the view in the visitor's local history (localStorage only).
 */
export function Player({ videoId, title, className }: PlayerProps) {
  const { recordView } = useLibrary();

  React.useEffect(() => {
    recordView(videoId);
  }, [recordView, videoId]);

  // `origin` must match the embedding page, and is only knowable on the client.
  const [origin, setOrigin] = React.useState<string | undefined>(undefined);
  React.useEffect(() => setOrigin(window.location.origin), []);

  const src = React.useMemo(
    () => buildEmbedUrl(videoId, { autoplay: true, controls: true, jsApi: true, origin }),
    [videoId, origin],
  );

  return (
    <div
      className={cn(
        // Full-bleed on phones, framed card on larger screens.
        '-mx-4 overflow-hidden bg-black sm:mx-0 sm:rounded-card sm:shadow-lifted',
        className,
      )}
    >
      <div className="relative aspect-video w-full">
        <iframe
          key={src}
          src={src}
          title={title}
          className="absolute inset-0 size-full border-0"
          {...EMBED_IFRAME_PROPS}
        />
      </div>
    </div>
  );
}
