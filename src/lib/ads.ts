/**
 * Every ad unit on the site, in one place.
 *
 * One network: Adsterra. Every banner slot renders an Adsterra unit directly, the
 * popunder and social bar are Adsterra's own page-level scripts, and the native
 * in-feed cards are Adsterra's native unit. Nothing here is a build-time constant —
 * the operator toggles come from the database (see the admin panel), so a unit can
 * be switched off without a redeploy.
 *
 * The identifiers are public by design: they ship inside the ad tags on every page.
 * They are registered per domain, so they only earn on the site they were issued for.
 */

export type AdsterraSize = 'leaderboard' | 'billboard' | 'rectangle' | 'halfpage' | 'skyscraper' | 'mobile';

export interface AdsterraUnit {
  key: string;
  width: number;
  height: number;
  label: string;
}

export const ADSTERRA_UNITS: Record<AdsterraSize, AdsterraUnit> = {
  leaderboard: { key: 'a08aade8ebe405d96caace16fd1d8fef', width: 728, height: 90, label: '728×90' },
  billboard: { key: '40fe38d61fb101211ff91ca7ec2c5662', width: 468, height: 60, label: '468×60' },
  rectangle: { key: '77e95598e6587882383591eb50e2c579', width: 300, height: 250, label: '300×250' },
  halfpage: { key: 'fc43a18858cb54cb881e0d7f0bf76165', width: 160, height: 600, label: '160×600' },
  /** 160×300 — the tallest unit that still fits the 16rem rail. */
  skyscraper: { key: 'bdfe7d22f73e8f349839a68bc9964637', width: 160, height: 300, label: '160×300' },
  mobile: { key: '74b0c4c9c836c927f0b4508940294240', width: 320, height: 50, label: '320×50' },
};

/** Adsterra page-level scripts. */
export const ADSTERRA_SCRIPTS = {
  popunder: {
    src: 'https://pl31851518.profitableratecpmnetwork.com/77/ae/3b/77ae3bc0ce514429c46a955cdc94f82c.js',
  },
  socialBar: {
    src: 'https://pl31851516.profitableratecpmnetwork.com/1f/17/86/1f17867bca03ad73a80e69fe99839220.js',
  },
} as const;

/** Adsterra native in-feed unit — the sponsored cards in the feed. */
export const ADSTERRA_NATIVE = {
  src: 'https://pl31851519.profitableratecpmnetwork.com/7396021155e4e607a4dc35d40e17fdc4/invoke.js',
  containerId: 'container-7396021155e4e607a4dc35d40e17fdc4',
} as const;

/** Direct link, for places where a plain hyperlink is the right shape of ad. */
export const SMARTLINK_HREF = 'https://www.profitableratecpmnetwork.com/v1bney37?key=843022975f4085641faece3d0de77db0';

/** Where a banner unit's loader lives (Adsterra fills it from the network root). */
export const ADSTERRA_BANNER_BASE = 'https://www.profitableratecpmnetwork.com';

// ── Placements ──────────────────────────────────────────────────────────────

export interface AdPlacement {
  /** The Adsterra unit this slot renders. */
  unit: AdsterraSize;
  /**
   * Unit used below the `sm` breakpoint, where the primary one is wider than the
   * viewport. Rendering a 728px frame on a phone clips the advert rather than
   * shrinking it, so the slot swaps to a unit that actually fits.
   */
  mobile?: AdsterraSize;
  /** Width reserved on the page. */
  width: number;
  height: number;
  /** Shown to the visitor under the slot and used as its accessible name. */
  caption: string;
}

/**
 * Named slots.
 *
 * Each page composes its slots from distinct names so the same unit never competes
 * with itself for a position on one screen.
 */
export const AD_PLACEMENTS = {
  // Lead slot of the browsing pages: one wide unit where there is room, one narrow
  // unit where there is not. Only the visible one is ever rendered.
  'lead-wide': { unit: 'leaderboard', width: 728, height: 90, caption: 'Advertisement' },
  'lead-narrow': { unit: 'mobile', width: 320, height: 50, caption: 'Advertisement' },
  // Home.
  'home-super': { unit: 'leaderboard', mobile: 'mobile', width: 728, height: 90, caption: 'Advertisement' },
  'home-square': { unit: 'rectangle', width: 300, height: 250, caption: 'Advertisement' },
  'home-strip': { unit: 'billboard', mobile: 'mobile', width: 468, height: 60, caption: 'Advertisement' },
  // In-feed, on the listing pages.
  'feed-rectangle': { unit: 'rectangle', width: 300, height: 250, caption: 'Advertisement' },
  'feed-billboard': { unit: 'billboard', mobile: 'mobile', width: 468, height: 60, caption: 'Advertisement' },
  // Watch page.
  'watch-rectangle': { unit: 'rectangle', width: 300, height: 250, caption: 'Advertisement' },
  'watch-billboard': { unit: 'billboard', mobile: 'mobile', width: 468, height: 60, caption: 'Advertisement' },
  'watch-promo': { unit: 'rectangle', width: 300, height: 250, caption: 'Advertisement' },
  'poster-square': { unit: 'rectangle', width: 300, height: 250, caption: 'Advertisement' },
  // Global rail (desktop only — the column is 16rem wide).
  'rail-tall': { unit: 'halfpage', width: 160, height: 600, caption: 'Advertisement' },
  'rail-tile': { unit: 'skyscraper', width: 160, height: 300, caption: 'Advertisement' },
  // Global footer band: the small, wide units that have nowhere else to sit.
  'band-a': { unit: 'mobile', width: 320, height: 50, caption: 'Partner offer' },
  'band-b': { unit: 'mobile', width: 320, height: 50, caption: 'Partner offer' },
  'band-c': { unit: 'billboard', mobile: 'mobile', width: 468, height: 60, caption: 'Partner offer' },
} as const satisfies Record<string, AdPlacement>;

export type AdPlacementName = keyof typeof AD_PLACEMENTS;

// ── Operator switches ───────────────────────────────────────────────────────

/**
 * Switches the admin panel owns. Every one defaults to on — a fresh deployment is
 * monetised, and the operator turns off what they do not want.
 */
export const AD_SETTING_KEYS = [
  'ads_enabled',
  'ads_native',
  'ads_invideo',
  'ads_page_scripts',
] as const;

export type AdSettingKey = (typeof AD_SETTING_KEYS)[number];

export interface AdConfig {
  /** Master switch for every unit on the site. */
  enabled: boolean;
  /** In-feed native cards. */
  native: boolean;
  /** The unit that sits over a video player. */
  inVideo: boolean;
  /** Adsterra's own page-level scripts: popunder and social bar. */
  pageScripts: boolean;
}

export const DEFAULT_AD_CONFIG: AdConfig = {
  enabled: true,
  native: true,
  inVideo: true,
  pageScripts: true,
};

/** A settings row is '1'/'0'; anything unset falls back to the default above. */
function readSwitch(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

/**
 * Build the runtime config from stored settings.
 *
 * `NEXT_PUBLIC_ADS_ENABLED=false` still wins: a build-time kill switch is useful for
 * screenshots and staging, where touching the live database would be wrong.
 */
export function adConfigFromSettings(settings: Record<string, string | undefined>): AdConfig {
  const envOff = /^(0|false|no|off)$/i.test((process.env.NEXT_PUBLIC_ADS_ENABLED ?? '').trim());
  const config: AdConfig = {
    enabled: readSwitch(settings.ads_enabled, DEFAULT_AD_CONFIG.enabled),
    native: readSwitch(settings.ads_native, DEFAULT_AD_CONFIG.native),
    inVideo: readSwitch(settings.ads_invideo, DEFAULT_AD_CONFIG.inVideo),
    pageScripts: readSwitch(settings.ads_page_scripts, DEFAULT_AD_CONFIG.pageScripts),
  };
  return envOff ? { ...config, enabled: false } : config;
}

/** The snippet each Adsterra unit is built from, rendered inside its own frame. */
export function adsterraSnippet(size: AdsterraSize): string {
  const { key, width, height } = ADSTERRA_UNITS[size];
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
    <script type="text/javascript" src="${ADSTERRA_BANNER_BASE}/${key}/invoke.js"></script>
  </body>
</html>`;
}
