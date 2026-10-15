'use client';

import { toQuery } from '@/lib/utils';
import type { TubeFeedResult, TubeSort } from './models';

/**
 * Browser-side client for the tube feed.
 *
 * The browser only ever calls our own `/api/tube/videos` route — the source site
 * URLs, the SQLite file and the scraper all stay server-side. This is the only
 * dependency the feed UI has on the API shape.
 */

export interface TubeQuery {
  page?: number;
  perPage?: number;
  q?: string;
  source?: string;
  tag?: string;
  sort?: TubeSort;
  /** Skip pinned rows — the home page shows them in their own shelf. */
  excludePinned?: boolean;
}

export interface TubeSourceSummary {
  id: string;
  name: string;
  count: number;
}

export interface TubePage extends TubeFeedResult {
  sources: TubeSourceSummary[];
}

/**
 * The sites we index, with counts — powers the nav rail. Independent of
 * `fetchTubePage` because the rail needs the full source list (including sites with
 * nothing indexed yet), not just the top few that a feed page happens to return.
 */
export async function fetchTubeSources(signal?: AbortSignal): Promise<TubeSourceSummary[]> {
  const response = await fetch('/api/tube/sources', {
    signal: signal ?? null,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`Could not load the source list (${response.status}).`);

  const body = (await response.json()) as { data?: { sources?: TubeSourceSummary[] } };
  return body.data?.sources ?? [];
}

export async function fetchTubePage(query: TubeQuery, signal?: AbortSignal): Promise<TubePage> {
  const response = await fetch(
    `/api/tube/videos${toQuery({
      page: query.page,
      perPage: query.perPage,
      q: query.q,
      source: query.source,
      tag: query.tag,
      sort: query.sort,
      excludePinned: query.excludePinned,
    })}`,
    { signal: signal ?? null, headers: { Accept: 'application/json' } },
  );

  if (!response.ok) throw new Error(`Could not load the video feed (${response.status}).`);

  const body = (await response.json()) as { data?: TubePage };
  if (!body.data) throw new Error('The video feed returned an unexpected payload.');
  return body.data;
}
