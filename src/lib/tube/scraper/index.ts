import { createHash } from 'node:crypto';

import { dedupeThumbnails, ensureSource, finishSyncRun, getSetting, getVideoEmbedState, hideVideoByUrl, isSourceEnabled, lastAddedAt, markSourceSynced, startSyncRun, upsertVideo } from '../db';
import { fetchPage } from '../html';
import type { ScrapedPost, SyncRunSummary } from '../models';
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
  /**
   * Full-depth mode: ignore the incremental watermark and re-read every post —
   * including ones already indexed — so posts stored by an older parser expand to
   * their full clip count and link-only rows are re-resolved. A routine refresh
   * must not do this: it would re-fetch the entire catalogue on every run.
   */
  full?: boolean;
}

const POLITENESS_DELAY_MS = 350;
const ENTRIES_PER_PAGE_CAP = 60;

export function videoIdForUrl(pageUrl: string): string {
  return createHash('sha1').update(pageUrl).digest('hex').slice(0, 16);
}

/** Stable id for one clip inside a multi-video post: hash of post + its CDN URL. */
function videoIdForClip(pageUrl: string, embedUrl: string): string {
  return createHash('sha1').update(`${pageUrl}#${embedUrl}`).digest('hex').slice(0, 16);
}

/**
 * Store a parsed post: one row per clip it carries, plus the gallery on the first
 * row (and as fallback posters for the rest).
 */
function storePost(adapterId: string, post: ScrapedPost, stats: { added: number; updated: number }): void {
  const gallery = post.galleryUrls;

  if (post.videos.length === 0) {
    // Photo set: one gallery row, embedType 'gallery'. A post with neither video
    // nor photos (an erotic story, or a page that no longer exists) is not content
    // the feed can present: skip it, and retire any legacy row left behind by an
    // older crawler so a story never renders as a broken card.
    if (!post.title.trim() && gallery.length === 0) return;
    if (gallery.length === 0) return;
    const { added } = upsertVideo({
      id: videoIdForUrl(post.pageUrl),
      sourceId: adapterId,
      title: post.title || 'Photo set',
      description: post.description,
      thumbnailUrl: post.thumbnailUrl ?? gallery[0] ?? null,
      embedUrl: null,
      embedType: 'gallery',
      pageUrl: post.pageUrl,
      durationSeconds: null,
      tags: post.tags,
      publishedAt: post.publishedAt,
      galleryUrls: gallery,
      // The post's own data is authoritative: a legacy row's stale embed must go.
      replaceEmbed: true,
    });
    if (added) stats.added += 1;
    return;
  }

  post.videos.forEach((clip, index) => {
    const isHead = index === 0;
    // The head row keeps the post's canonical URL as its page anchor and the whole
    // gallery; siblings get per-clip ids so two clips of one post can never collide.
    const { added } = upsertVideo({
      id: isHead ? videoIdForUrl(post.pageUrl) : videoIdForClip(post.pageUrl, clip.embedUrl ?? String(index)),
      sourceId: adapterId,
      title: clip.title || post.title || 'Untitled',
      description: isHead ? post.description : null,
      thumbnailUrl: clip.thumbnailUrl ?? post.thumbnailUrl,
      embedUrl: clip.embedUrl,
      embedType: clip.embedType,
      pageUrl: isHead ? post.pageUrl : `${post.pageUrl}#${index + 1}`,
      durationSeconds: clip.durationSeconds,
      tags: post.tags,
      publishedAt: post.publishedAt,
      galleryUrls: isHead ? gallery : [],
      // parsePost read the post itself: its mp4 outranks whatever an older,
      // worse parser guessed (it once filed related-post embeds as players).
      replaceEmbed: true,
    });
    if (added) stats.added += 1;
  });
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

        // ── Incremental stop: sources list newest first, so the first page whose
        // entries are all already indexed marks the end of new material. Walking
        // further would burn post-fetches on rows we already have. Full mode skips
        // this — a backfill has to reach pages the watermark hides.
        if (!options.full && lastAddedAt(adapter.id) && entries.length > 0) {
          const allKnown = entries.every((entry) => getVideoEmbedState(entry.pageUrl) !== 'missing');
          if (allKnown) break;
        }

        // Per-page progress line — long backfills run for tens of minutes and a
        // silent run looks wedged from the outside even when it is working.
        console.log(
          `[sync] ${adapter.id} page ${page}/${pagesPerSource}: ${entries.length} entries, +${stats.added} added so far, ${postFetchBudget} fetches left`,
        );

        for (const rawEntry of entries) {
          const id = videoIdForUrl(rawEntry.pageUrl);
          const existing = getVideoEmbedState(rawEntry.pageUrl);
          // ── Structured post path: the adapter reads the whole post (every clip
          // it ships, plus its photo gallery) and we store one row per clip. Runs
          // when the post is new — or when a legacy run left it link-only, so an
          // upgrade to this parser repairs those rows on the next sync. Full mode
          // re-reads known rows too, so collapsed multi-video posts expand; the
          // upsert is idempotent, so re-reading cannot create duplicates.
          if (adapter.parsePost && (options.full || existing !== 'ok')) {
            if (postFetchBudget <= 0) continue;
            postFetchBudget -= 1;
            try {
              const postHtml = await fetchPageWithRetry(rawEntry.pageUrl);
              const post = adapter.parsePost(postHtml, rawEntry.pageUrl);
              // Fill listing metadata into whatever the post itself did not carry.
              post.title = post.title || rawEntry.title;
              post.thumbnailUrl = post.thumbnailUrl ?? rawEntry.thumbnailUrl;
              if (!post.videos.length && !post.galleryUrls.length) {
                // A skipped post (erotic story, removed page): retire any legacy
                // row an older crawler filed for it so it cannot render at all.
                if (existing !== 'missing') hideVideoByUrl(rawEntry.pageUrl);
              }
              storePost(adapter.id, post, stats);
            } catch {
              stats.errors += 1;
            }
            await sleep(sourceDelay);
            continue;
          }

          // ── Legacy enrich path (adapters without a structured post parser).
          // `existing` is one of 'missing' | 'no-embed' | 'ok': enrich anything we
          // don't already have a player for.
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

  // Post-run hygiene: two clips of one post share their source's frame by design,
  // and re-posted scenes reuse stills across uploads. Strip every poster claimed
  // twice to its newest owner so a grid never shows the same face twice.
  dedupeThumbnails(40);

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
