'use client';

import * as React from 'react';

const STORAGE_KEY = 'velvet.sidebar.v1';

/** Rail width, in rem, for each state. Kept in one place so layout maths can't drift. */
export const SIDEBAR_WIDTH = { expanded: 17.5, collapsed: 4.75 } as const;

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue>({ collapsed: false, toggle: () => undefined });

/**
 * Sidebar collapse state.
 *
 * Read from storage in an effect rather than during render: the server has no idea
 * what this visitor prefers, so rendering the stored value on the first pass would
 * be a hydration mismatch. The consequence is one frame at the default width, which
 * is visually invisible and much cheaper than shipping the state from the server.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'collapsed');
    } catch {
      /* Storage unavailable — the default (expanded) is fine. */
    }
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'collapsed' : 'expanded');
      } catch {
        /* Preference just won't persist. */
      }
      return next;
    });
  }, []);

  const value = React.useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  return React.useContext(SidebarContext);
}
