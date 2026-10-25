/**
 * Local watch history.
 *
 * Browser-local on purpose: no account is required to use the site, and a history
 * of what an adult-site visitor opened is exactly the kind of data that should
 * never leave their device. The entry carries only what a card needs to render,
 * so the shelf works without re-querying the catalogue.
 */

export interface HistoryEntry {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  sourceName: string;
  sourceId: string;
  durationSeconds: number | null;
  views: number;
  pageUrl: string;
  /** ISO timestamp of when the visitor opened it. */
  viewedAt: string;
}

const STORAGE_KEY = 'velvet.history.v1';
const MAX_ENTRIES = 12;

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.title === 'string';
}

export function readHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function recordHistory(entry: Omit<HistoryEntry, 'viewedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const rest = readHistory().filter((item) => item.id !== entry.id);
    const next: HistoryEntry[] = [{ ...entry, viewedAt: new Date().toISOString() }, ...rest].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Storage unavailable (private mode, quota) — history is a convenience. */
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing to do. */
  }
}
