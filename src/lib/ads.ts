/**
 * Every ad unit on the site, in one place.
 *
 * Two networks, deliberately layered: JuicyAds is the primary fill for all 17 zones
 * issued for this domain, and an Adsterra unit stands in for a slot *only* when the
 * JuicyAds one failed to render. Nothing here is a build-time constant — the operator
 * toggles come from the database (see the admin panel), so a unit can be switched off
 * without a redeploy.
 *
 * The identifiers are public by design: they ship inside the ad tags on every page.
 * They are registered per domain, so they only earn on the site they were issued for.
 */

/**
 * Static site-verification token, read from the server-rendered `<head>` by
 * JuicyAds' crawler. It does not run JavaScript, so this must stay in `metadata`
 * rather than being injected client-side.
 */
export const JUICYADS_VERIFICATION = '03e66023ac6e4d0cd6382434a9b333db';

/** JuicyAds endpoints: the zone loader, the float ad, and the native feed. */
export const JUICYADS_SCRIPTS = {
  /** Loads once per page and fills every zone queued in `window.adsbyjuicy`. */
  loader: 'https://poweredby.jads.co/js/jads.js',
  /** Float ad — attaches itself to the viewport. */
  float: 'https://poweredby.jads.co/js/jfc.js',
  /** Native in-feed cards. */
  native: 'https://js.juicyads.com/juicyads.native-ads.min.js',
} as const;

export interface JuicyZone {
  /** Zone id as issued. Also the DOM id of its `<ins>` element. */
  id: string;
  width: number;
  height: number;
  /** The label JuicyAds used when it issued the zone. */
  label: string;
}

/**
 * All 17 zones, named for the shape rather than the marketing label, because the
 * shape is what decides where a unit can physically sit.
 */
export const JUICY_ZONES = {
  rectangle: { id: '1129024', width: 300, height: 250, label: 'Image 300×250' },
  leaderboard: { id: '1129026', width: 728, height: 90, label: 'Leaderboard 728×90' },
  halfpage: { id: '1129027', width: 160, height: 600, label: 'Skyscraper 160×600' },
  promoBox: { id: '1129028', width: 133, height: 139, label: 'Box 133×139' },
  squareSmall: { id: '1129029', width: 125, height: 125, label: 'Square 125×125' },
  tile: { id: '1129030', width: 158, height: 168, label: 'Tile 158×168' },
  square: { id: '1129031', width: 250, height: 250, label: 'Square 250×250' },
  strip: { id: '1129032', width: 300, height: 100, label: 'Strip 300×100' },
  stripSmall: { id: '1129033', width: 300, height: 50, label: 'Strip 300×50' },
  superBanner: { id: '1129034', width: 908, height: 258, label: 'Super banner 908×258' },
  billboard: { id: '1129035', width: 468, height: 60, label: 'Banner 468×60' },
  micro: { id: '1129036', width: 178, height: 46, label: 'Micro 178×46' },
  microWide: { id: '1129038', width: 258, height: 46, label: 'Micro 258×46' },
  microBar: { id: '1129037', width: 178, height: 18, label: 'Micro bar 178×18' },
  /** Sits over the player on a watch page. */
  inVideo: { id: '1129041', width: 308, height: 286, label: 'In-video 308×286' },
} as const satisfies Record<string, JuicyZone>;

export type JuicyZoneName = keyof typeof JUICY_ZONES;

/** Page-level zones, used by their own components rather than a slot. */
export const JUICY_FLOAT_ZONE = '1129039';
export const JUICY_NATIVE_ZONE = '1129043';

/** Adsterra units, used as the stand-in for a slot JuicyAds did not fill. */
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

/** Adsterra native in-feed unit — the stand-in for the JuicyAds native cards. */
export const ADSTERRA_NATIVE = {
  src: 'https://pl31851519.profitableratecpmnetwork.com/7396021155e4e607a4dc35d40e17fdc4/invoke.js',
  containerId: 'container-7396021155e4e607a4dc35d40e17fdc4',
} as const;

/** Direct link, for places where a plain hyperlink is the right shape of ad. */
export const SMARTLINK_HREF = 'https://www.profitableratecpmnetwork.com/v1bney37?key=843022975f4085641faece3d0de77db0';

/** Where a banner unit's loader lives (Adsterra fills it from the network root). */
export const ADSTERRA_BANNER_BASE = 'https://www.profitableratecpmnetwork.com';

/**
 * How long a zone gets to fill before we treat it as failed and hand the slot to
 * Adsterra. Their loader is async and usually settles in a few hundred ms, so this
 * is generous — it exists to catch a blocked or erroring request without leaving a
 * hole on the page.
 */
export const JUICY_FILL_TIMEOUT_MS = 3500;

// ── Placements ──────────────────────────────────────────────────────────────

export interface AdPlacement {
  /** Primary unit. */
  juicy: JuicyZone | null;
  /**
   * Adsterra unit rendered when the primary did not fill. Chosen to fit the space
   * the slot occupies, so a stand-in never breaks the column it lands in.
   */
  fallback: AdsterraSize | null;
  /** Width reserved on the page. */
  width: number;
  height: number;
  /** Shown to the visitor under the slot and used as its accessible name. */
  caption: string;
}

/**
 * Named slots.
 *
 * A JuicyAds zone owns its `<ins>` element by id, so **a zone must never appear twice
 * on one page** — that is why each page composes its slots from distinct names.
 */
export const AD_PLACEMENTS = {
  // Lead slot of the browsing pages: one wide unit where there is room, one narrow
  // unit where there is not. Only the visible one is ever filled.
  'lead-wide': { juicy: JUICY_ZONES.leaderboard, fallback: 'leaderboard', width: 728, height: 90, caption: 'Advertisement' },
  'lead-narrow': { juicy: JUICY_ZONES.stripSmall, fallback: 'mobile', width: 320, height: 50, caption: 'Advertisement' },
  // Home.
  'home-super': { juicy: JUICY_ZONES.superBanner, fallback: 'leaderboard', width: 908, height: 258, caption: 'Advertisement' },
  'home-square': { juicy: JUICY_ZONES.square, fallback: 'skyscraper', width: 250, height: 250, caption: 'Advertisement' },
  'home-strip': { juicy: JUICY_ZONES.strip, fallback: 'mobile', width: 300, height: 100, caption: 'Advertisement' },
  // In-feed, on the listing pages.
  'feed-rectangle': { juicy: JUICY_ZONES.rectangle, fallback: 'rectangle', width: 300, height: 250, caption: 'Advertisement' },
  'feed-billboard': { juicy: JUICY_ZONES.billboard, fallback: 'billboard', width: 468, height: 60, caption: 'Advertisement' },
  // Watch page.
  'watch-rectangle': { juicy: JUICY_ZONES.rectangle, fallback: 'rectangle', width: 300, height: 250, caption: 'Advertisement' },
  'watch-billboard': { juicy: JUICY_ZONES.billboard, fallback: 'billboard', width: 468, height: 60, caption: 'Advertisement' },
  'watch-promo': { juicy: JUICY_ZONES.promoBox, fallback: 'skyscraper', width: 133, height: 139, caption: 'Advertisement' },
  'poster-square': { juicy: JUICY_ZONES.squareSmall, fallback: 'mobile', width: 125, height: 125, caption: 'Advertisement' },
  // Global rail (desktop only — the column is 16rem wide).
  'rail-tall': { juicy: JUICY_ZONES.halfpage, fallback: 'halfpage', width: 160, height: 600, caption: 'Advertisement' },
  'rail-tile': { juicy: JUICY_ZONES.tile, fallback: 'skyscraper', width: 158, height: 168, caption: 'Advertisement' },
  // Global footer band: the small, wide units that have nowhere else to sit.
  'band-a': { juicy: JUICY_ZONES.micro, fallback: 'mobile', width: 178, height: 46, caption: 'Partner offer' },
  'band-b': { juicy: JUICY_ZONES.microWide, fallback: 'mobile', width: 258, height: 46, caption: 'Partner offer' },
  'band-c': { juicy: JUICY_ZONES.microBar, fallback: 'mobile', width: 178, height: 18, caption: 'Partner offer' },
} as const satisfies Record<string, AdPlacement>;

export type AdPlacementName = keyof typeof AD_PLACEMENTS;

// ── Operator switches ───────────────────────────────────────────────────────

/**
 * Switches the admin panel owns. Every one defaults to on — a fresh deployment is
 * monetised, and the operator turns off what they do not want.
 */
export const AD_SETTING_KEYS = [
  'ads_enabled',
  'ads_juicyads',
  'ads_adsterra_fallback',
  'ads_float',
  'ads_native',
  'ads_invideo',
  'ads_page_scripts',
] as const;

export type AdSettingKey = (typeof AD_SETTING_KEYS)[number];

export interface AdConfig {
  /** Master switch for every unit on the site. */
  enabled: boolean;
  /** Fill slots with JuicyAds. Off means Adsterra fills them directly. */
  juicyAds: boolean;
  /** Render an Adsterra unit when a JuicyAds zone fails to fill. */
  adsterraFallback: boolean;
  /** JuicyAds float ad. */
  float: boolean;
  /** In-feed native cards (JuicyAds primary, Adsterra stand-in). */
  native: boolean;
  /** The zone that sits over a video player. */
  inVideo: boolean;
  /** Adsterra's own page-level scripts: popunder and social bar. */
  pageScripts: boolean;
}

export const DEFAULT_AD_CONFIG: AdConfig = {
  enabled: true,
  juicyAds: true,
  adsterraFallback: true,
  float: true,
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
    juicyAds: readSwitch(settings.ads_juicyads, DEFAULT_AD_CONFIG.juicyAds),
    adsterraFallback: readSwitch(settings.ads_adsterra_fallback, DEFAULT_AD_CONFIG.adsterraFallback),
    float: readSwitch(settings.ads_float, DEFAULT_AD_CONFIG.float),
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
