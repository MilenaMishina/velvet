'use client';

import * as React from 'react';

/**
 * Fires `onEnter` when the returned ref scrolls into view. Powers infinite feeds
 * without attaching a scroll listener (which would run on every frame).
 */
export function useInView(onEnter: () => void, options: { rootMargin?: string; enabled?: boolean } = {}) {
  const { rootMargin = '900px 0px', enabled = true } = options;
  const ref = React.useRef<HTMLDivElement | null>(null);
  const callbackRef = React.useRef(onEnter);
  callbackRef.current = onEnter;

  React.useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    // A very old browser without IntersectionObserver simply gets the manual button.
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callbackRef.current();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
