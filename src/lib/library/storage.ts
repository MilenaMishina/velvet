/**
 * Client-side library persistence.
 *
 * We store **only YouTube video ids** plus the timestamp we saved them at — no
 * titles, no thumbnails, no stream data. Everything shown in the UI is re-fetched
 * from the official API through our proxy, which keeps the app inside YouTube's
 * terms (nothing is re-hosted or cached beyond the API's own allowances) and means
 * a stale save can never display wrong metadata.
 */

export const LIBRARY_STORAGE_KEY = 'velvet.library.v1';

export const LIBRARY_LISTS = ['watchLater', 'favorites', 'history'] as const;
export type LibraryList = (typeof LIBRARY_LISTS)[number];

/** Lists a user can toggle by hand; history is written implicitly. */
export type ToggleableList = Exclude<LibraryList, 'history'>;

export interface SavedItem {
  id: string;
  /** Epoch ms. Newest-first ordering everywhere. */
  at: number;
}

export type LibraryState = Record<LibraryList, SavedItem[]>;

/** Hard caps: localStorage is small, and a 1,000-entry history is useless anyway. */
const LIMITS: Record<LibraryList, number> = { watchLater: 300, favorites: 300, history: 120 };

const YOUTUBE_ID = /^[\w-]{11}$/;

export function emptyLibrary(): LibraryState {
  return { watchLater: [], favorites: [], history: [] };
}

function sanitiseList(raw: unknown, limit: number): SavedItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: SavedItem[] = [];
  for (const entry of raw) {
    const id = typeof entry === 'string' ? entry : (entry as SavedItem | null)?.id;
    if (typeof id !== 'string' || !YOUTUBE_ID.test(id) || seen.has(id)) continue;
    const at = typeof entry === 'object' && entry !== null ? Number((entry as SavedItem).at) : NaN;
    seen.add(id);
    items.push({ id, at: Number.isFinite(at) ? at : Date.now() });
  }
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** Parse whatever is in storage defensively — it is user-editable data. */
export function parseLibrary(raw: string | null): LibraryState {
  if (!raw) return emptyLibrary();
  try {
    const parsed = JSON.parse(raw) as Partial<Record<LibraryList, unknown>>;
    return {
      watchLater: sanitiseList(parsed.watchLater, LIMITS.watchLater),
      favorites: sanitiseList(parsed.favorites, LIMITS.favorites),
      history: sanitiseList(parsed.history, LIMITS.history),
    };
  } catch {
    return emptyLibrary();
  }
}

export function readLibrary(): LibraryState {
  if (typeof window === 'undefined') return emptyLibrary();
  try {
    return parseLibrary(window.localStorage.getItem(LIBRARY_STORAGE_KEY));
  } catch {
    return emptyLibrary();
  }
}

export function writeLibrary(state: LibraryState): void {
  try {
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Quota or private mode — the in-memory state still works for this session. */
  }
}

/** Add to the front, de-duplicating and trimming to the list's cap. */
export function upsert(items: SavedItem[], id: string, limit: number): SavedItem[] {
  return [{ id, at: Date.now() }, ...items.filter((item) => item.id !== id)].slice(0, limit);
}

export function limitFor(list: LibraryList): number {
  return LIMITS[list];
}
