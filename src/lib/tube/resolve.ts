import { resolveAttemptAt, setVideoEmbed } from './db';
import { fetchPage } from './html';
import type { TubeVideo } from './models';
import { SOURCE_ADAPTERS, type ScrapedEntry } from './scraper/sources';

/**
 * Resolving a player for a video the sync could only link to.
 *
 * The catalogue is built by scraping, and a scrape can fail for reasons that have
 * nothing to do with the video: a bot challenge answered with a 200, a rate-limited
 * burst, a page that was between edits. The row is still worth keeping — its title,
 * poster and source link are good — but "open the original" is a poor thing to hand a
 * visitor who came here to watch something.
 *
 * So a row with no player is re-read from its own page and whatever the source now
 * offers is stored back. This reuses the source adapter's own `enrich`, which already
 * prefers a direct file over a frame — a native `<video>` is the most reliable player
 * we can render, and the visitor stays on the site.
 */

/** A page fetch that never becomes the reason a watch page hangs. */
const RESOLVE_TIMEOUT_MS = 6000;

/** Don't re-read the same row more often than this, however often it is visited. */
const RETRY_WINDOW_MS = 6 * 60 * 60 * 1000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('resolve timed out')), ms)),
  ]);
}

/** The stored row, shaped as the entry an adapter's `enrich` expects to receive. */
function entryFrom(video: TubeVideo): ScrapedEntry {
  return {
    pageUrl: video.pageUrl,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    embedUrl: video.embedUrl,
    embedType: video.embedType,
    durationSeconds: video.durationSeconds,
    tags: video.tags,
    publishedAt: video.publishedAt,
    description: video.description,
  };
}

export interface ResolveOutcome {
  /** True when a player was found and stored. */
  resolved: boolean;
  /** True when we skipped the fetch because the row was attempted recently. */
  skipped: boolean;
  video: TubeVideo | null;
}

/**
 * Re-read one video's page and store whatever player it offers.
 *
 * Anything other than a definite player is treated as "still nothing": a partial read,
 * a timeout or a challenge page must never overwrite a row with a broken URL. When no
 * player is found the attempt is still stamped, so this costs one request per row per
 * window rather than one per visit.
 */
export async function resolveVideoPlayer(video: TubeVideo, options: { force?: boolean } = {}): Promise<ResolveOutcome> {
  const adapter = SOURCE_ADAPTERS.find((candidate) => candidate.id === video.sourceId);
  if (!adapter?.needsPostFetch) return { resolved: false, skipped: true, video: null };

  if (!options.force) {
    const attemptedAt = resolveAttemptAt(video.id);
    if (attemptedAt && Date.now() - Date.parse(attemptedAt) < RETRY_WINDOW_MS) {
      return { resolved: false, skipped: true, video: null };
    }
  }

  try {
    const html = await withTimeout(fetchPage(video.pageUrl), RESOLVE_TIMEOUT_MS);
    const enriched = adapter.enrich(entryFrom(video), html);
    if (!enriched.embedUrl || enriched.embedType === 'link') {
      setVideoEmbed(video.id, null, 'link');
      return { resolved: false, skipped: false, video: null };
    }
    setVideoEmbed(video.id, enriched.embedUrl, enriched.embedType);
    return {
      resolved: true,
      skipped: false,
      video: { ...video, embedUrl: enriched.embedUrl, embedType: enriched.embedType },
    };
  } catch {
    // Unreachable, challenged or slow: leave the row exactly as it was.
    setVideoEmbed(video.id, null, 'link');
    return { resolved: false, skipped: false, video: null };
  }
}

/**
 * Work through the queue, oldest rows first.
 *
 * Bounded by the caller so a repair run is a handful of seconds and can be repeated
 * from the admin panel until the queue is empty.
 */
export async function repairUnplayableVideos(limit = 25): Promise<{ attempted: number; resolved: number; remaining: number }> {
  const { listUnplayableVideos, countUnplayableVideos } = await import('./db');
  const queue = listUnplayableVideos(limit, 0);
  let resolved = 0;

  for (const video of queue) {
    const outcome = await resolveVideoPlayer(video, { force: true });
    if (outcome.resolved) resolved += 1;
  }

  return { attempted: queue.length, resolved, remaining: countUnplayableVideos() };
}
