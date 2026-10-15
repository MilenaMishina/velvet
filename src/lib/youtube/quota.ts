import { serverEnv } from '@/lib/env';
import { getCacheStore, namespaced } from '@/lib/cache/store';
import { YouTubeApiError } from '@/lib/youtube/errors';
import type { QuotaSnapshot } from '@/lib/youtube/models';

/**
 * Quota accounting.
 *
 * YouTube's default allowance is 10,000 units/day, and the costs are wildly
 * uneven: one `search.list` costs as much as one hundred `videos.list` calls.
 * Every call in this app therefore declares its cost up front, and the governor
 * refuses spend that would blow the configured budget — the UI then degrades to
 * cached/fallback content instead of returning hard errors.
 *
 * The ledger is best-effort: an in-process counter, mirrored into the shared
 * cache store so multiple instances converge. It is a safety rail, not an
 * accountant — Google's own quota page remains the source of truth.
 */

export const QUOTA_COST = {
  /** The expensive one. Avoid unless there is no cheaper path. */
  search: 100,
  videos: 1,
  channels: 1,
  playlistItems: 1,
  playlists: 1,
  videoCategories: 1,
} as const;

export type QuotaOperation = keyof typeof QUOTA_COST;

interface Ledger {
  day: string;
  spent: number;
}

let local: Ledger = { day: '', spent: 0 };

/** YouTube quota resets at midnight Pacific Time, not UTC. */
function pacificOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'longOffset',
  }).formatToParts(at);
  const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT-08:00';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(raw);
  if (!match) return -480;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function pacificDayKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export function nextPacificMidnight(at: Date = new Date()): Date {
  const offset = pacificOffsetMinutes(at);
  const shifted = new Date(at.getTime() + offset * 60_000);
  const nextMidnightAsUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1,
  );
  return new Date(nextMidnightAsUtc - offset * 60_000);
}

const ledgerKey = (day: string) => namespaced(`quota:${day}`);

async function loadLedger(): Promise<Ledger> {
  const day = pacificDayKey();
  if (local.day !== day) local = { day, spent: 0 };

  const store = getCacheStore();
  const remote = await store.get<Ledger>(ledgerKey(day));
  if (remote?.data && remote.data.day === day && remote.data.spent > local.spent) {
    local = { day, spent: remote.data.spent };
  }
  return local;
}

async function persist(ledger: Ledger): Promise<void> {
  const store = getCacheStore();
  // Live a little past the reset so late writes can't resurrect yesterday's total.
  const ttl = Math.max(60, Math.ceil((nextPacificMidnight().getTime() - Date.now()) / 1000) + 300);
  await store.set(ledgerKey(ledger.day), { data: ledger, storedAt: Date.now(), expiresAt: Date.now() + ttl * 1000 }, ttl);
}

/**
 * Reserve quota before making a call. Throws `QUOTA_GUARD` when the budget is
 * spent, which callers translate into a graceful, cached-content fallback.
 */
export async function reserve(operation: QuotaOperation, calls = 1): Promise<number> {
  const cost = QUOTA_COST[operation] * calls;
  const { maxUnitsPerRequest, dailyQuotaBudget } = serverEnv.youtube;

  if (cost > maxUnitsPerRequest) {
    throw new YouTubeApiError(
      'QUOTA_GUARD',
      `Refusing a ${cost}-unit ${operation} call: over the ${maxUnitsPerRequest}-unit per-request ceiling.`,
    );
  }

  const ledger = await loadLedger();
  if (ledger.spent + cost > dailyQuotaBudget) {
    throw new YouTubeApiError(
      'QUOTA_GUARD',
      `Daily quota budget reached (${ledger.spent}/${dailyQuotaBudget} units).`,
      { detail: `next reset ${nextPacificMidnight().toISOString()}` },
    );
  }

  local = { day: ledger.day, spent: ledger.spent + cost };
  void persist(local).catch(() => undefined);
  return cost;
}

/** Check headroom without spending — used to decide if a search is affordable. */
export async function hasHeadroom(operation: QuotaOperation, calls = 1): Promise<boolean> {
  const cost = QUOTA_COST[operation] * calls;
  const ledger = await loadLedger();
  return ledger.spent + cost <= serverEnv.youtube.dailyQuotaBudget;
}

/** Mark spend that happened outside `reserve` (e.g. a retried request). */
export async function record(operation: QuotaOperation, calls = 1): Promise<void> {
  const ledger = await loadLedger();
  local = { day: ledger.day, spent: ledger.spent + QUOTA_COST[operation] * calls };
  void persist(local).catch(() => undefined);
}

/** Mark the daily budget as exhausted after Google itself said 403 quotaExceeded. */
export async function markExhausted(): Promise<void> {
  const ledger = await loadLedger();
  local = { day: ledger.day, spent: serverEnv.youtube.dailyQuotaBudget };
  void persist(local).catch(() => undefined);
}

export async function snapshot(): Promise<QuotaSnapshot> {
  const ledger = await loadLedger();
  const budget = serverEnv.youtube.dailyQuotaBudget;
  return {
    spent: ledger.spent,
    budget,
    remaining: Math.max(0, budget - ledger.spent),
    resetsAt: nextPacificMidnight().toISOString(),
  };
}
