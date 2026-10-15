'use client';

import Script from 'next/script';

import { adRuntime } from '@/components/ads/ad-runtime';
import { ADSTERRA_SCRIPTS, JUICYADS_SCRIPTS, JUICY_FLOAT_ZONE, type AdConfig } from '@/lib/ads';

/**
 * Page-level scripts. These attach themselves to the document rather than filling a
 * slot, so each appears exactly once — in the root layout — and each is gated by the
 * operator switch that owns it.
 *
 * Every one of them is loaded after the page is interactive. None of them paints
 * anything, and a popunder that delays the page a visitor actually came for is worth
 * less than the page it interrupted.
 */

/**
 * The JuicyAds zone loader.
 *
 * Must be present for any slot to fill, so its failure is recorded globally rather
 * than per slot: every `<AdSlot>` checks that flag and hands its slot straight to
 * Adsterra instead of waiting out a timeout it cannot win.
 */
export function AdJuicyLoader({ config }: { config: AdConfig }) {
  if (!config.enabled || !config.juicyAds) return null;
  return (
    <Script
      id="juicyads-loader"
      src={JUICYADS_SCRIPTS.loader}
      data-cfasync="false"
      strategy="afterInteractive"
      onError={() => {
        adRuntime.juicyLoaderFailed = true;
      }}
    />
  );
}

/**
 * The JuicyAds float ad.
 *
 * Its zone has to be on the page *before* the script runs, and two `next/script` tags
 * are not ordered against each other — so the global and the loader are emitted from
 * one inline script, in that order, exactly as the network's snippet is written.
 */
export function AdFloat({ config }: { config: AdConfig }) {
  if (!config.enabled || !config.juicyAds || !config.float) return null;
  const inline = `
    juicy_adzone = '${JUICY_FLOAT_ZONE}';
    (function () {
      var s = document.createElement('script');
      s.src = '${JUICYADS_SCRIPTS.float}';
      s.charset = 'utf-8';
      s.async = true;
      document.body.appendChild(s);
    })();
  `;
  return <Script id="juicyads-float" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: inline }} />;
}

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
