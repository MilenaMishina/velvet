'use client';

import * as React from 'react';

/**
 * Debounce a rapidly changing value.
 *
 * Used by the search box: `search.list` costs 100 quota units, so we must never
 * fire a request per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
