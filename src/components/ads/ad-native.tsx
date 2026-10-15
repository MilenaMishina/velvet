'use client';

import Script from 'next/script';
import * as React from 'react';

import { useAdConfig } from '@/components/ads/ad-config-provider';
import { adRuntime } from '@/components/ads/ad-runtime';
import { ADSTERRA_NATIVE, JUICYADS_SCRIPTS, JUICY_NATIVE_ZONE } from '@/lib/ads';
import { cn } from '@/lib/utils';

/**
 * In-feed native cards.
 *
 * JuicyAds' native unit renders its own cards in place of the anchors it is pointed
 * at, so it cannot be measured the way a banner zone can — a loaded script either
 * produces cards or it does not. What *is* reliable is a failed request, so the
 * stand-in is driven by the script's error path: if the loader is blocked or refused,
 * Adsterra's native unit takes the place instead of leaving a blank row.
 *
 * Use it once per page — both networks key their units by id.
 */
export function AdNative({ className }: { className?: string }) {
  const config = useAdConfig();
  const [standIn, setStandIn] = React.useState(!config.juicyAds);

  // Adsterra's native loader looks for a container that already exists, so it is
  // appended after that container renders rather than emitted as JSX — React does not
  // execute a <script> element it renders.
  //
  // It goes into our own empty host rather than `document.body`: the loader writes
  // markup into whatever it is given, and markup React does not know about, sitting
  // inside a tree React does manage, is how `removeChild` crashes happen.
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const host = hostRef.current;
    if (!standIn || !host || host.querySelector('script')) return;
    const script = document.createElement('script');
    script.src = ADSTERRA_NATIVE.src;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    host.appendChild(script);
  }, [standIn]);

  if (!config.enabled || !config.native) return null;

  return (
    <div role="complementary" aria-label="Sponsored content" className={cn('space-y-2', className)}>
      <p className="text-center text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Sponsored</p>

      {standIn ? (
        <div className="panel flex min-h-[8rem] items-center justify-center rounded-card p-3">
          <div id={ADSTERRA_NATIVE.containerId} className="w-full" />
          <div ref={hostRef} />
        </div>
      ) : (
        <Script
          id="juicyads-native"
          src={JUICYADS_SCRIPTS.native}
          strategy="afterInteractive"
          data-id="juicyads-native-ads"
          data-ad-zone={JUICY_NATIVE_ZONE}
          data-targets="a"
          onError={() => {
            adRuntime.juicyNativeFailed = true;
            setStandIn(true);
          }}
        />
      )}
    </div>
  );
}
