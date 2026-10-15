/**
 * Ad units registered for this domain.
 *
 * One file holds every identifier so a unit can be resized, added or switched off
 * without hunting through components. The values are public by design — they ship
 * inside the ad tags on every page — but they are issued *per domain* by the
 * network, so they only earn on the site they were registered against.
 */

/**
 * Static site-verification token, read from the server-rendered `<head>` by the
 * network's crawler. It does not run JavaScript, so this must stay in `metadata`
 * rather than being injected client-side.
 */
export const JUICYADS_VERIFICATION = '03e66023ac6e4d0cd6382434a9b333db';

/** Master switch. `NEXT_PUBLIC_ADS_ENABLED=false` serves the site with no ad tags. */
const adsFlag = process.env.NEXT_PUBLIC_ADS_ENABLED;
export const adsEnabled = adsFlag === undefined || !/^(0|false|no|off)$/i.test(adsFlag.trim());

/**
 * Where a banner unit's loader lives.
 *
 * The snippet the network issues for each size is generic: it declares a global
 * `atOptions` (key, format, width, height) and then loads `<key>/invoke.js`, which
 * reads that global and writes the creative in. The per-unit `pl…` hosts are used
 * for the injected page-level scripts (popunder, social bar), while banner units
 * answer from the network root — asked with this site's `Referer`, each of the six
 * keys below returns a distinct ~50 KB unit payload, which is what confirms the
 * host and the keys rather than any documentation.
 */
export const AD_BANNER_BASE = 'https://www.profitableratecpmnetwork.com';

export type AdSize = 'leaderboard' | 'billboard' | 'rectangle' | 'halfpage' | 'skyscraper' | 'mobile';

export interface AdUnit {
  /** Account key for this size. */
  key: string;
  width: number;
  height: number;
  /** Shown under the slot and used as the frame's accessible name. */
  label: string;
}

export const AD_UNITS: Record<AdSize, AdUnit> = {
  leaderboard: { key: 'a08aade8ebe405d96caace16fd1d8fef', width: 728, height: 90, label: '728×90' },
  billboard: { key: '40fe38d61fb101211ff91ca7ec2c5662', width: 468, height: 60, label: '468×60' },
  rectangle: { key: '77e95598e6587882383591eb50e2c579', width: 300, height: 250, label: '300×250' },
  /** 160×600 — the tall rail unit. */
  halfpage: { key: 'fc43a18858cb54cb881e0d7f0bf76165', width: 160, height: 600, label: '160×600' },
  /** 160×300 — the short rail unit. */
  skyscraper: { key: 'bdfe7d22f73e8f349839a68bc9964637', width: 160, height: 300, label: '160×300' },
  /** 320×50 — the phone-width slot that stands in for the leaderboard. */
  mobile: { key: '74b0c4c9c836c927f0b4508940294240', width: 320, height: 50, label: '320×50' },
};

/**
 * Scripts the network injects into the page itself.
 *
 * These are not slotted units: once loaded they attach themselves to the document
 * (a popunder and a floating social bar), so each is included exactly once in the
 * root layout — two copies of either would double-count and fight each other.
 */
export const adScripts = {
  popunder: {
    src: 'https://pl31851518.profitableratecpmnetwork.com/77/ae/3b/77ae3bc0ce514429c46a955cdc94f82c.js',
  },
  socialBar: {
    src: 'https://pl31851516.profitableratecpmnetwork.com/1f/17/86/1f17867bca03ad73a80e69fe99839220.js',
  },
} as const;

/** Native (in-feed) unit: one async loader that fills a container with a fixed id. */
export const nativeBanner = {
  src: 'https://pl31851519.profitableratecpmnetwork.com/7396021155e4e607a4dc35d40e17fdc4/invoke.js',
  containerId: 'container-7396021155e4e607a4dc35d40e17fdc4',
} as const;

/** Direct link, for places where a plain hyperlink is the right shape of ad. */
export const smartlink = {
  href: 'https://www.profitableratecpmnetwork.com/v1bney37?key=843022975f4085641faece3d0de77db0',
} as const;

/**
 * The complete document for one banner slot.
 *
 * It is rendered inside an iframe because every unit configures itself through the
 * same global: two banners in one document would overwrite each other's `atOptions`
 * and the second would render at the first one's size. A frame gives each slot its
 * own `atOptions`, its own loader and its own creative. It is deliberately left
 * unsandboxed — the loader only answers when the request carries this site's
 * `Referer`, which an opaque origin would not send.
 */
export function bannerSnippet(size: AdSize): string {
  const { key, width, height } = AD_UNITS[size];
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <base target="_blank" />
    <style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style>
  </head>
  <body>
    <script type="text/javascript">
      atOptions = {
        'key': '${key}',
        'format': 'iframe',
        'height': ${height},
        'width': ${width},
        'params': {}
      };
    </script>
    <script type="text/javascript" src="${AD_BANNER_BASE}/${key}/invoke.js"></script>
  </body>
</html>`;
}
