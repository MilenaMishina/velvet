'use client';

import Script from 'next/script';

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

/** Adsterra's social bar — the floating strip, anchored to the end of the body. */
export function AdSocialBar({ config }: { config: AdConfig }) {
  if (!config.enabled || !config.pageScripts) return null;
  return <Script id="ad-social-bar" src={ADSTERRA_SCRIPTS.socialBar.src} strategy="afterInteractive" />;
}
