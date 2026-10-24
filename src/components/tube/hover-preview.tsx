'use client';

import * as React from 'react';

/** How long the pointer must rest before we spend bandwidth on a preview. */
const HOVER_DELAY_MS = 550;

/**
 * Silent hover preview.
 *
 * On premium tube sites, resting on a card starts playing the scene silently —
 * it is the single biggest difference between "looks like a tube" and "feels
 * like one", and it filters dead posters instantly. We only dare this for rows
 * whose embed is a direct media file: the browser plays the same publisher CDN
 * URL the watch page would, muted and looping, with no extra infrastructure.
 *
 * `preload="none"` means nothing is fetched until the timer fires; leaving the
 * card tears the element down, stopping the download immediately.
 */
export function HoverPreview({ src, poster, className }: { src: string; poster?: string | null; className?: string }) {
  const [active, setActive] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const arm = React.useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => setActive(true), HOVER_DELAY_MS);
  }, []);

  const disarm = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setActive(false);
  }, []);

  if (!active) {
    return <div aria-hidden onMouseEnter={arm} onMouseLeave={disarm} className={className} />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="none"
      onMouseLeave={disarm}
      aria-hidden
      className={className}
    />
  );
}
