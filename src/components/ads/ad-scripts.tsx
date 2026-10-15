import Script from 'next/script';

import { adScripts, adsEnabled } from '@/lib/ads';

/**
 * Page-level scripts: these attach themselves to the document rather than filling a
 * slot, so each appears exactly once — in the root layout.
 */

/**
 * Popunder.
 *
 * `beforeInteractive` is used deliberately: the network expects this tag in the
 * server-rendered head, and unlike the banners it earns from the visitor's *first*
 * click, so arriving with the document beats arriving after hydration.
 */
export function AdPopunder() {
  if (!adsEnabled) return null;
  return <Script id="ad-popunder" src={adScripts.popunder.src} strategy="beforeInteractive" />;
}

/** Social bar — the floating strip, anchored to the end of the body. */
export function AdSocialBar() {
  if (!adsEnabled) return null;
  return <Script id="ad-social-bar" src={adScripts.socialBar.src} strategy="afterInteractive" />;
}
