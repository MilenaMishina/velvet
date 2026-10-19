'use client';

import * as React from 'react';

import { useAdConfig } from '@/components/ads/ad-config-provider';
import { ADSTERRA_NATIVE } from '@/lib/ads';
import { cn } from '@/lib/utils';

/**
 * In-feed native cards — Adsterra's native unit.
 *
 * The loader looks for a container that already exists, so it is appended after that
 * container renders rather than emitted as JSX — React does not execute a <script>
 * element it renders.
 *
 * It goes into our own empty host rather than `document.body`: the loader writes
 * markup into whatever it is given, and markup React does not know about, sitting
 * inside a tree React does manage, is how `removeChild` crashes happen.
 *
 * Use it once per page — the unit is keyed by container id.
 */
export function AdNative({ className }: { className?: string }) {
  const config = useAdConfig();

  const hostRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || host.querySelector('script')) return;
    const script = document.createElement('script');
    script.src = ADSTERRA_NATIVE.src;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    host.appendChild(script);
  }, []);

  if (!config.enabled || !config.native) return null;

  return (
    <div role="complementary" aria-label="Sponsored content" className={cn('space-y-2', className)}>
      <p className="text-center text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Sponsored</p>
      <div className="panel flex min-h-[8rem] items-center justify-center rounded-card p-3">
        <div id={ADSTERRA_NATIVE.containerId} className="w-full" />
        <div ref={hostRef} />
      </div>
    </div>
  );
}
