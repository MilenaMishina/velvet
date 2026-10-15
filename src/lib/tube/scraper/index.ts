import { createHash } from 'node:crypto';

import { ensureSource, finishSyncRun, getSetting, getVideoEmbedState, isSourceEnabled, markSourceSynced, startSyncRun, upsertVideo } from '../db';
import { fetchPage } from '../html';
import type { SyncRunSummary } from '../models';
import { SOURCE_ADAPTERS, type ScrapedEntry } from './sources';

/**
 * Sync orchestrator — the "when these sites upload new videos, they
 * automatically get added to our site" engine.
 *
 * For every enabled source it walks a few listing pages, parses entries, and
 * upserts anything new (deduped by the canonical page URL). Entries that were
 * previously stored without a playable embed (e.g. Cloudflare-blocked pages)
 * are retried on later runs. Every run is recorded in `sync_runs` so the admin
 * panel can show exactly what happened.
 */

export interface SyncOptions {
  trigger: 'manual' | 'cron';
  /**
   * Listing pages walked per source. Defaults to 2 for a routine refresh; a
   * backfill walks far deeper (every source we follow exposes hundreds of pages).
   */
  pagesPerSource?: number;
  /**
   * Post-page fetches allowed **per source** per run (default 30).
   *
   * The allowance is per source, not per run: a single dense listing can easily
   * offer more entries than a run should fetch, and a shared budget would let the
   * first adapter in the list consume all of it and leave every later source with
   * no playable embeds. Per source keeps the run inside ~1–2 minutes either way.
   */
  maxPostFetches?: number;
  /**
   * Gap between requests to the same source. The default is fine for a refresh,
   * but a long backfill should ask for more room so we stay a good citizen on a
   * source we are about to hit a few thousand times.
   */
  requestDelayMs?: number;
  /**
   * Restrict the run to these source ids. Omitted means every enabled source.
   * A backfill uses this to spend its whole budget on the sources that actually
   * publish playable video, instead of on ones we only follow for completeness.
   */
  sources?: string[];
}

const POLITENESS_DELAY_MS = 350;
const ENTRIES_PER_PAGE_CAP = 60;

export function videoIdForUrl(pageUrl: string): string {
  return createHash('sha1').update(pageUrl).digest('hex').slice(0, 16);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a post page, retrying once on failure.
 *
 * Sources that sit behind a cheap rate limiter answer a burst with a short
 * connection reset even though the same URL works seconds later — during a deep
 * backfill that would silently cost us the embed for one post in ten. One retry
 * after a beat recovers almost all of them without hammering anything.
 */
async function fetchPageWithRetry(url: string): Promise<string> {
  try {
    return await fetchPage(url);
  } catch {
    await sleep(1_200);
    return await fetchPage(url);
  }
}

export async function runSync(options: SyncOptions): Promise<SyncRunSummary> {
  const pagesPerSource = Math.min(400, Math.max(1, options.pagesPerSource ?? 2));
  const postFetchBudgetPerSource = Math.max(1, options.maxPostFetches ?? 30);
  const politenessDelay = Math.max(0, options.requestDelayMs ?? POLITENESS_DELAY_MS);
  const runId = startSyncRun(options.trigger);
  const startedAt = new Date().toISOString();

  const perSource: Record<string, { added: number; updated: number; errors: number }> = {};
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  const requested = options.sources?.length ? new Set(options.sources) : null;

  for (const adapter of SOURCE_ADAPTERS) {
    ensureSource(adapter.id, adapter.name, adapter.baseUrl, adapter.thumbnailAspect);
    // `enabled` is an operator switch (see `setSourceEnabled`): a source we have
    // deliberately parked should not cost a run any requests.
    if (!isSourceEnabled(adapter.id)) continue;
    if (requested && !requested.has(adapter.id)) continue;
    const stats = { added: 0, updated: 0, errors: 0 };
    // Each source gets its own allowance — see `maxPostFetches` above.
    let postFetchBudget = postFetchBudgetPerSource;
    // A source may need a slower pace than the run asked for; the slower one wins.
    const sourceDelay = Math.max(politenessDelay, adapter.requestDelayMs ?? 0);

    try {
      for (let page = 1; page <= pagesPerSource; page += 1) {
        const listingUrl = adapter.listingUrl(page);
        let html: string;
        try {
          html = await fetchPage(listingUrl);
        } catch {
          stats.errors += 1;
          break; // Listing unreachable — skip this source's remaining pages.
        }

        const entries = adapter.parseListing(html, listingUrl).slice(0, ENTRIES_PER_PAGE_CAP);
        for (const rawEntry of entries) {
          const id = videoIdForUrl(rawEntry.pageUrl);
          const existing = getVideoEmbedState(rawEntry.pageUrl);
          // `existing` is one of 'missing' | 'no-embed' | 'ok' — all strings, so the
          // old `!existing` test was never true and a brand-new entry was stored
          // link-only, only gaining its player on some later run. Compare the state
          // directly instead: enrich anything we don't already have a player for.
          const needsEnrich = adapter.needsPostFetch && existing !== 'ok';

          let enriched: ScrapedEntry = rawEntry;
          if (needsEnrich && postFetchBudget > 0) {
            postFetchBudget -= 1;
            try {
              const postHtml = await fetchPageWithRetry(rawEntry.pageUrl);
              enriched = adapter.enrich(rawEntry, postHtml);
            } catch {
              stats.errors += 1;
            }              await sleep(sourceDelay);
          }

          // A row we can neither name nor play is not a video the feed can present:
          // it would render as a blank "Untitled" card. Some listings advertise
          // pages whose post never loads (a site that only serves its player to a
          // live browser session), and for those the honest outcome is to index
          // nothing rather than to publish an empty shell.
          if (!enriched.title.trim() && !enriched.embedUrl) continue;

          const { added } = upsertVideo({
            id,
            sourceId: adapter.id,
            title: enriched.title,
            description: enriched.description,
            thumbnailUrl: enriched.thumbnailUrl,
            embedUrl: enriched.embedUrl,
            embedType: enriched.embedType,
            pageUrl: rawEntry.pageUrl,
            durationSeconds: enriched.durationSeconds,
            tags: enriched.tags,
            publishedAt: enriched.publishedAt,
          });

          if (added) stats.added += 1;
          else if (enriched.embedUrl && existing === 'no-embed') stats.updated += 1;
        }
        await sleep(sourceDelay);
      }
    } catch {
      stats.errors += 1;
    }

    markSourceSynced(adapter.id);
    perSource[adapter.id] = stats;
    totalAdded += stats.added;
    totalUpdated += stats.updated;
    totalErrors += stats.errors;
  }

  const summary = {
    status: totalErrors > 0 && totalAdded + totalUpdated === 0 ? ('error' as const) : ('success' as const),
    added: totalAdded,
    updated: totalUpdated,
    errors: totalErrors,
    perSource,
  };
  finishSyncRun(runId, summary);

  return {
    id: runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    trigger: options.trigger,
    ...summary,
  };
}

// ── In-process auto-sync scheduler ──────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerRunning = false;

/**
 * Lazily starts the in-process scheduler (first server import). The interval is
 * read from the `auto_sync_minutes` setting (fallback: AUTO_SYNC_INTERVAL_MINUTES
 * env). 0 disables it. The cron endpoint and the admin "Sync now" button work
 * regardless.
 */
export function ensureAutoSyncScheduler(): void {
  if (schedulerTimer || schedulerRunning) return;
  const envMinutes = Number(process.env.AUTO_SYNC_INTERVAL_MINUTES ?? 120);
  const envFallback = Number.isFinite(envMinutes) && envMinutes >= 0 ? envMinutes : 120;
  const startSetting = Number(getSetting('auto_sync_minutes') ?? '');
  const minutes = Number.isFinite(startSetting) && startSetting >= 0 ? startSetting : envFallback;
  if (minutes === 0) return;

  schedulerTimer = setInterval(() => {
    void (async () => {
      if (schedulerRunning) return;
      const setting = Number(getSetting('auto_sync_minutes') ?? '');
      const effective = Number.isFinite(setting) && setting >= 0 ? setting : minutes;
      if (effective === 0) return;
      schedulerRunning = true;
      try {
        await runSync({ trigger: 'cron', pagesPerSource: 2 });
      } catch {
        // A failed tick is recorded in sync_runs by runSync itself.
      } finally {
        schedulerRunning = false;
      }
    })();
  }, minutes * 60_000);

  // Don't hold the process open just for the scheduler.
  schedulerTimer.unref?.();
}
