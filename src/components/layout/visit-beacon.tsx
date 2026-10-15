'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

/**
 * Anonymous visit counter.
 *
 * Fires once per navigation. The endpoint assigns a random visitor id in an
 * httpOnly cookie on first contact, which is what makes "unique visitors" mean
 * something without an account, a fingerprint or a third-party script.
 */
export function VisitBeacon() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!pathname) return;
    // `keepalive` so a beacon fired during a navigation still completes.
    void fetch('/api/tube/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
