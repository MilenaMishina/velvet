'use client';

import Script from 'next/script';
import * as React from 'react';

import { ADSTERRA_SCRIPTS, type AdConfig } from '@/lib/ads';

/**
 * Page-level scripts. These attach themselves to the document rather than filling a
 * slot, so each appears exactly once — in the root layout — and each is gated by the
 * operator switch that owns it.
 *
 * Both are loaded after the page is interactive. Neither paints anything, and a
 * popunder that delays the page a visitor actually came for is worth less than the
 * page it interrupted.
 */

/** Adsterra's popunder. Sits in the document head, where that network expects it. */
export function AdPopunder({ config }: { config: AdConfig }) {
  if (!config.enabled || !config.pageScripts) return null;
  return <Script id="ad-popunder" src={ADSTERRA_SCRIPTS.popunder.src} strategy="afterInteractive" />;
}

/**
 * Adsterra's social bar — the floating strip, anchored to the end of the body.
 *
 * Desktop only, on purpose. On a phone the bar covers the thumb zone and pins a
 * second, unclosable ad layer over a page that already carries banner units — the
 * single most common way an ad-supported site starts to feel broken on mobile.
 * The in-page units are untouched, so nothing monetisable is lost where it shows.
 */
export function AdSocialBar({ config }: { config: AdConfig }) {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (!config.enabled || !config.pageScripts || !isDesktop) return null;
  return <Script id="ad-social-bar" src={ADSTERRA_SCRIPTS.socialBar.src} strategy="afterInteractive" />;
}
