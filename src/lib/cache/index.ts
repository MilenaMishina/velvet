import { serverEnv } from '@/lib/env';
import { type CacheEntry, getCacheStore, namespaced } from '@/lib/cache/store';

export type CacheStatus = 'miss' | 'fresh' | 'stale' | 'bypass';

export interface CacheResult<T> {
  data: T;
  status: CacheStatus;
  /** Age of the served payload in seconds (0 for freshly fetched data). */
  ageSeconds: number;
}

export interface CachedOptions<T> {
  key: string;
  ttlSeconds: number;
  /** How long a stale value may still be served if the origin fails. */
  staleGraceSeconds?: number;
  loader: () => Promise<T>;
  /** Skip the cache entirely (used by debug/admin paths). */
  skip?: boolean;
}

/**
 * In-process single flight. When ten visitors hit the same cold key at once we
 * make one YouTube call, not ten — the single biggest quota saver in the app.
 */
const inflight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = loader().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * Read-through cache with stale-while-revalidate semantics:
 *
 *  fresh  → serve immediately, zero quota spent
 *  stale  → try to refresh; if YouTube errors (quota, 5xx) serve the stale copy
 *  miss   → fetch, store, serve
 */
export async function cached<T>(options: CachedOptions<T>): Promise<CacheResult<T>> {
  const { key, ttlSeconds, loader, skip } = options;
  const staleGrace = options.staleGraceSeconds ?? serverEnv.cache.staleGrace;

  if (skip) {
    return { data: await loader(), status: 'bypass', ageSeconds: 0 };
  }

  const store = getCacheStore();
  const fullKey = namespaced(key);
  const now = Date.now();
  const entry = await store.get<T>(fullKey);

  if (entry && entry.expiresAt > now) {
    return { data: entry.data, status: 'fresh', ageSeconds: Math.round((now - entry.storedAt) / 1000) };
  }

  const refresh = async (): Promise<CacheResult<T>> => {
    const data = await dedupe(fullKey, loader);
    const fresh: CacheEntry<T> = {
      data,
      storedAt: Date.now(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    // Keep stale copies around past their TTL so they can act as a safety net.
    await store.set(fullKey, fresh, ttlSeconds + staleGrace);
    return { data, status: 'miss', ageSeconds: 0 };
  };

  if (!entry) return refresh();

  const withinGrace = now - entry.expiresAt < staleGrace * 1000;
  try {
    return await refresh();
  } catch (error) {
    if (withinGrace) {
      console.warn(`[cache] serving stale "${key}" after refresh failure:`, (error as Error).message);
      return { data: entry.data, status: 'stale', ageSeconds: Math.round((now - entry.storedAt) / 1000) };
    }
    throw error;
  }
}

export async function invalidate(key: string): Promise<void> {
  await getCacheStore().delete(namespaced(key));
}

/** `Cache-Control` value matching a given TTL, for edge/CDN reuse. */
export function cacheControlFor(ttlSeconds: number, staleGraceSeconds = 60): string {
  return `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds + staleGraceSeconds}`;
}
