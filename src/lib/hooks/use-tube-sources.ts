'use client';

import * as React from 'react';

import { fetchTubeSources, type TubeSourceSummary } from '@/lib/tube/api';

/**
 * The indexed-source list for the browse rail.
 *
 * Fetched on the client because the rail lives in the root layout: reading SQLite
 * there would opt every page in the app out of static rendering, and the list
 * changes every time a sync finds a new site. A failure is swallowed on purpose —
 * the rail is navigation chrome, and an empty rail must never break a page.
 */
export function useTubeSources(): TubeSourceSummary[] {
  const [sources, setSources] = React.useState<TubeSourceSummary[]>([]);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await fetchTubeSources(controller.signal);
        if (!controller.signal.aborted) setSources(next);
      } catch {
        /* Navigation chrome only — leave the rail empty. */
      }
    })();
    return () => controller.abort();
  }, []);

  return sources;
}
