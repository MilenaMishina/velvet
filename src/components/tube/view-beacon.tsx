'use client';

import * as React from 'react';

import { formatExactNumber } from '@/lib/format';

/**
 * Displays the view count and registers this visit.
 *
 * The count rendered on the server is already correct for everyone who came before,
 * so the beacon only ever needs to *add* one and adopt the authoritative number the
 * API returns. A failure is silent: a view counter is never worth an error message.
 */
export function ViewBeacon({ videoId, initialViews }: { videoId: string; initialViews: number }) {
  const [views, setViews] = React.useState(initialViews);
  const sent = React.useRef(false);

  React.useEffect(() => {
    // Strict Mode mounts twice in development; the ref keeps it to one beacon.
    if (sent.current) return;
    sent.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/tube/videos/${encodeURIComponent(videoId)}/view`, {
          method: 'POST',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const body = (await response.json()) as { data?: { views?: number } };
        if (!controller.signal.aborted && typeof body.data?.views === 'number') setViews(body.data.views);
      } catch {
        /* Offline or aborted — the server-rendered count stands. */
      }
    })();
    return () => controller.abort();
  }, [videoId]);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {formatExactNumber(views)} {views === 1 ? 'view' : 'views'}
    </span>
  );
}
