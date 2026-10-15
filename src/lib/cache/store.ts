import { serverEnv } from '@/lib/env';

/** A cached payload plus the bookkeeping needed for stale-while-revalidate. */
export interface CacheEntry<T> {
  data: T;
  /** Epoch ms when the value was written. */
  storedAt: number;
  /** Epoch ms after which the value is considered stale. */
  expiresAt: number;
}

export interface CacheStore {
  readonly name: string;
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Namespace + schema version, so a shape change can't collide with old data. */
const NAMESPACE = 'velvet:v1';
export const namespaced = (key: string) => `${NAMESPACE}:${key}`;

/**
 * Per-instance LRU. Perfectly adequate for a single long-lived Node server and a
 * sensible default on serverless (each warm lambda keeps its own slice).
 */
class MemoryStore implements CacheStore {
  readonly name = 'memory';
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly maxEntries: number) {}

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    // Refresh recency so hot keys survive eviction.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

/**
 * Upstash Redis / Vercel KV over their shared REST contract — no SDK needed, so
 * the bundle stays lean and the same code path works on any host.
 */
class RedisRestStore implements CacheStore {
  readonly name = 'redis-rest';

  constructor(private readonly url: string, private readonly token: string) {}

  private async command<T>(command: unknown[]): Promise<T | null> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { result?: T | null };
      return payload.result ?? null;
    } catch {
      // A cache outage must never take the app down — degrade to origin fetches.
      return null;
    }
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.command<string>(['GET', key]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>, ttlSeconds: number): Promise<void> {
    await this.command(['SET', key, JSON.stringify(entry), 'EX', Math.max(1, Math.floor(ttlSeconds))]);
  }

  async delete(key: string): Promise<void> {
    await this.command(['DEL', key]);
  }
}

let store: CacheStore | null = null;

export function getCacheStore(): CacheStore {
  if (store) return store;
  const { driver, redis, memoryMaxEntries } = serverEnv.cache;
  if ((driver === 'upstash' || driver === 'vercel-kv') && redis) {
    store = new RedisRestStore(redis.url, redis.token);
  } else {
    store = new MemoryStore(memoryMaxEntries);
  }
  return store;
}
