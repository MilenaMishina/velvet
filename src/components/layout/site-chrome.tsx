'use client';

import { Megaphone } from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';

/**
 * Operator banner.
 *
 * Fetched rather than rendered on the server so the root layout stays static — the
 * notice is empty almost all of the time, and making every page dynamic for it
 * would be a bad trade. Renders nothing at all when there is no notice.
 */
export function SiteNotice() {
  const [notice, setNotice] = React.useState('');
  const pathname = usePathname();

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/tube/site', { signal: controller.signal, headers: { Accept: 'application/json' } });
        const body = (await response.json()) as { data?: { notice?: string } };
        if (!controller.signal.aborted) setNotice((body.data?.notice ?? '').trim());
      } catch {
        /* A notice is optional chrome. */
      }
    })();
    return () => controller.abort();
  }, [pathname]);

  if (!notice) return null;

  return (
    <p
      role="status"
      className="panel mb-6 flex items-start gap-2.5 rounded-card px-4 py-3 text-sm text-foreground-muted"
    >
      <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span className="whitespace-pre-line">{notice}</span>
    </p>
  );
}
