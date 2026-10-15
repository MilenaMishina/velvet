'use client';

import * as React from 'react';

import {
  emptyLibrary,
  type LibraryList,
  LIBRARY_STORAGE_KEY,
  type LibraryState,
  limitFor,
  parseLibrary,
  readLibrary,
  type ToggleableList,
  upsert,
  writeLibrary,
} from '@/lib/library/storage';

interface LibraryContextValue extends LibraryState {
  /** False during the first client render, so lists don't flash empty→full. */
  ready: boolean;
  has: (list: LibraryList, id: string) => boolean;
  toggle: (list: ToggleableList, id: string) => void;
  remove: (list: LibraryList, id: string) => void;
  clear: (list: LibraryList) => void;
  /** Called by the watch page; keeps a local, private viewing history. */
  recordView: (id: string) => void;
  counts: Record<LibraryList, number>;
}

const LibraryContext = React.createContext<LibraryContextValue | null>(null);

/**
 * Saved lists (Watch Later, Favorites, History) backed by localStorage.
 *
 * Everything is client-only and never leaves the browser — no account required,
 * no server storage, and the API only ever sees the ids we ask it to hydrate.
 */
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LibraryState>(emptyLibrary);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setState(readLibrary());
    setReady(true);
  }, []);

  // Mutations go through here so persistence can never be forgotten.
  const commit = React.useCallback((next: (current: LibraryState) => LibraryState) => {
    setState((current) => {
      const updated = next(current);
      writeLibrary(updated);
      return updated;
    });
  }, []);

  const toggle = React.useCallback(
    (list: ToggleableList, id: string) => {
      commit((current) => {
        const exists = current[list].some((item) => item.id === id);
        return {
          ...current,
          [list]: exists ? current[list].filter((item) => item.id !== id) : upsert(current[list], id, limitFor(list)),
        };
      });
    },
    [commit],
  );

  const remove = React.useCallback(
    (list: LibraryList, id: string) => {
      commit((current) => ({ ...current, [list]: current[list].filter((item) => item.id !== id) }));
    },
    [commit],
  );

  const clear = React.useCallback(
    (list: LibraryList) => {
      commit((current) => ({ ...current, [list]: [] }));
    },
    [commit],
  );

  const recordView = React.useCallback(
    (id: string) => {
      commit((current) => ({ ...current, history: upsert(current.history, id, limitFor('history')) }));
    },
    [commit],
  );

  // Another tab saved something: adopt its state rather than overwriting it.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LIBRARY_STORAGE_KEY) setState(parseLibrary(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = React.useMemo<LibraryContextValue>(
    () => ({
      ...state,
      ready,
      has: (list, id) => state[list].some((item) => item.id === id),
      toggle,
      remove,
      clear,
      recordView,
      counts: {
        watchLater: state.watchLater.length,
        favorites: state.favorites.length,
        history: state.history.length,
      },
    }),
    [state, ready, toggle, remove, clear, recordView],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const context = React.useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside <LibraryProvider>.');
  return context;
}
