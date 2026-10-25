'use client';

import * as React from 'react';

import { recordHistory, type HistoryEntry } from '@/lib/watch-history';

/**
 * Writes the current scene into local history.
 *
 * Rendered on the watch page and nowhere else: the card fields are passed in from
 * the server so no extra request is made, and the effect is keyed by id so a view
 * count tick doesn't re-write the entry.
 */
export function HistoryRecorder({ entry }: { entry: Omit<HistoryEntry, 'viewedAt'> }) {
  const { id, title, thumbnailUrl, sourceName, sourceId, durationSeconds, views, pageUrl } = entry;

  React.useEffect(() => {
    recordHistory({ id, title, thumbnailUrl, sourceName, sourceId, durationSeconds, views, pageUrl });
  }, [id, title, thumbnailUrl, sourceName, sourceId, durationSeconds, views, pageUrl]);

  return null;
}
