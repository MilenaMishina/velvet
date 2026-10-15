import type { TubeEmbedType } from '../models';
import { absoluteUrl, matchDuration, metaContent, normalizeDurationSeconds, pageTitle, slugToTitle, stripTags, tagAttr, windowAround } from '../html';

/**
 * Per-site adapters. Each one exposes a listing parser (cheap, no post fetches)
 * and an enrich step that reads the video's own page for the embed URL and
 * better metadata. Parsers are deliberately forgiving: a missed thumbnail or
 * duration is cosmetic, a missed embed degrades to a source link.
 */

export interface ScrapedEntry {
  pageUrl: string;
  title: string;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  embedType: TubeEmbedType;
  durationSeconds: number | null;
  tags: string[];
  publishedAt: string | null;
  description: string | null;
}

export interface SourceAdapter {
  id: string;
  name: string;
  baseUrl: string;
  /** Listing page for pagination index n (1-based). */
  listingUrl: (page: number) => string;
  parseListing: (html: string, pageUrl: string) => ScrapedEntry[];
  /** Pull the embed URL + better metadata from the video's own page. */
  enrich: (entryItem: ScrapedEntry, html: string) => ScrapedEntry;
  /** True when the listing alone doesn't carry the embed URL. */
  needsPostFetch: boolean;
  /**
   * Minimum gap between requests to this source, when it needs a slower pace than
   * the orchestrator's default. Some sources answer a burst with a degraded page
   * that still returns HTTP 200 — the player iframe is simply missing — so a source
   * like that has to declare its own pace rather than being scraped at full speed
   * and quietly losing most of its embeds.
   */
  requestDelayMs?: number;
  /**
   * Width ÷ height of this source's posters. Cards are shaped to match, because
   * cropping a portrait still into a 16:9 frame cuts the subject out of the shot.
   * Measured from the source's own images; omit for landscape-only sources.
   */
  thumbnailAspect?: number;
}

const AD_HOSTS = /(a-ads\.com|jerkmate\.com|acceptable\.a-ads)/i;

function makeEntry(partial: Partial<ScrapedEntry> & { pageUrl: string; title: string }): ScrapedEntry {
  return {
    thumbnailUrl: null,
    embedUrl: null,
    embedType: 'link',
    durationSeconds: null,
    tags: [],
    publishedAt: null,
    description: null,
    ...partial,
  };
}

/** Generic first-pass: collect candidate video-page links from any listing. */
function collectAnchors(html: string, filter: RegExp, base: string): Map<string, string> {
  const found = new Map<string, string>();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = tagAttr(`<a ${match[1]}>`, 'href');
    if (!href) continue;
    const absolute = absoluteUrl(href, base);
    if (!filter.test(absolute)) continue;
    const label = stripTags(match[2] ?? '');
    if (!found.has(absolute)) found.set(absolute, label);
  }
  return found;
}

/** Best iframe on a page, skipping known ad frames. */
function bestIframe(html: string, base: string): string | null {
  const tags = html.match(/<iframe[^>]*src=["'][^"']+["'][^>]*>/gi) ?? [];
  for (const tag of tags) {
    const src = tagAttr(tag, 'src');
    if (!src || AD_HOSTS.test(src)) continue;
    return absoluteUrl(src, base);
  }
  return null;
}

// ── aznude.com — own CDN with direct mp4/HLS ────────────────────────────────

const aznude: SourceAdapter = {
  id: 'aznude',
  name: 'AZ Nude',
  baseUrl: 'https://www.aznude.com',
  listingUrl: (page) => `https://www.aznude.com/browse/videos/recent/${page}.html`,
  needsPostFetch: true,
  parseListing(html, pageUrl) {
    // Scene cards link to the player page at /azncdn/<hash>/<hash>-hd.html.
    const links = collectAnchors(html, /aznude\.com\/azncdn\/[a-f0-9]+\/[a-f0-9]+-(hd|hi)\.html/i, pageUrl);
    const entries: ScrapedEntry[] = [];
    for (const [playerUrl] of links) {
      const path = playerUrl.slice(playerUrl.indexOf('/azncdn/'));
      const win = windowAround(html, path, 1600);
      entries.push(
        makeEntry({
          pageUrl: playerUrl,
          title: '', // finalized by enrich from the player page's <title>
          durationSeconds: normalizeDurationSeconds(matchDuration(win)),
          thumbnailUrl: win.match(/https:\/\/cdn\.aznude\.com\/[^"'\s]+\.(?:jpg|webp|png)/i)?.[0] ?? null,
          tags: ['aznude'],
        }),
      );
    }
    return entries;
  },
  enrich(entryItem, html) {
    const rawTitle = pageTitle(html) ?? '';
    const title = rawTitle.replace(/\s*-\s*AZNude\s*$/i, '').trim() || entryItem.title || 'AZNude scene';
    const mp4 =
      html.match(/https:\/\/cdn2\.aznude\.com\/[a-f0-9]+\/[a-f0-9]+-hd\.mp4/i)?.[0]
      ?? html.match(/https:\/\/cdn2?\.aznude\.com\/[^"'\s]+\.mp4/i)?.[0]
      ?? null;
    return {
      ...entryItem,
      title,
      embedUrl: mp4,
      embedType: mp4 ? 'video' : 'link',
      thumbnailUrl:
        entryItem.thumbnailUrl
        ?? metaContent(html, 'og:image')
        ?? html.match(/https:\/\/cdn\.aznude\.com\/[^"'\s]+\.(?:jpg|webp|png)/i)?.[0]
        ?? null,
    };
  },
};

// ── videocelebs.net — own /embed/{id} iframe player ─────────────────────────

const STATIC_VC_PATHS = /(contact-us|dmca|^actress$|^movie$|^tv-show$)/i;

const videocelebs: SourceAdapter = {
  id: 'videocelebs',
  name: 'Video Celebs',
  baseUrl: 'https://videocelebs.net',
  listingUrl: (page) => (page <= 1 ? 'https://videocelebs.net/' : `https://videocelebs.net/page/${page}`),
  needsPostFetch: true,
  // Its listing posters are 280x210 (4:3), not 16:9 like its full-size stills.
  thumbnailAspect: 4 / 3,
  // Measured: at 300 ms only ~25% of post pages come back with a player; at 2.5 s
  // it is ~90%. The slow pace is the difference between indexing this site and
  // indexing its URLs without anything to play.
  requestDelayMs: 2_500,
  parseListing(html, pageUrl) {
    const links = collectAnchors(html, /videocelebs\.net\/[a-z0-9-]+\.html$/i, pageUrl);
    const entries: ScrapedEntry[] = [];
    for (const [postUrl, label] of links) {
      const slug = postUrl.split('/').pop() ?? postUrl;
      if (STATIC_VC_PATHS.test(slug.replace('.html', ''))) continue;
      const win = windowAround(html, slug, 1600);
      entries.push(
        makeEntry({
          pageUrl: postUrl,
          title: label || slugToTitle(slug),
          thumbnailUrl: win.match(/https:\/\/videocelebs\.net\/contents\/videos_screenshots\/[^"'\s]+\.(?:jpg|webp|png)/i)?.[0] ?? null,
          tags: ['celebs'],
        }),
      );
    }
    return entries;
  },
  enrich(entryItem, html) {
    const embedMatch = html.match(/<iframe[^>]*src=["'](https:\/\/videocelebs\.net\/embed\/[^"']+)["']/i);
    const embedUrl = embedMatch?.[1] ?? null;
    // The post's own OpenGraph title is the cleanest label ("Katya Santos nude –
    // Pinoy Wife (Sukdulan) (2003)") and its description is a real synopsis, so both
    // beat the listing's anchor text and the slug. Its CDN also only serves the mp4
    // to a live session (a bare request 404s), which is why the player frame is the
    // embed and never a direct file.
    const ogTitle = stripTags(metaContent(html, 'og:title') ?? '');
    return {
      ...entryItem,
      embedUrl,
      embedType: embedUrl ? 'iframe' : 'link',
      title: ogTitle || entryItem.title || 'Video Celebs video',
      description: metaContent(html, 'og:description') ?? entryItem.description,
      thumbnailUrl: entryItem.thumbnailUrl ?? metaContent(html, 'og:image'),
    };
  },
};

// ── desihub.sh — Next.js site; each post carries a schema.org VideoObject ───

/** `/_next/image?url=<encoded>&w=…` → the CDN original it wraps. */
function decodeNextImage(block: string): string | null {
  const encoded = block.match(/\/_next\/image\?url=([^&"'\s]+)/i)?.[1];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded.replace(/&amp;/g, '&'));
  } catch {
    return null;
  }
}

/** The handful of VideoObject fields we index. */
interface SchemaVideoObject {
  name?: unknown;
  description?: unknown;
  thumbnailUrl?: unknown;
  uploadDate?: unknown;
  contentUrl?: unknown;
  embedUrl?: unknown;
}

/** Depth-first search for a `@type: VideoObject` node inside a parsed JSON-LD tree. */
function findVideoObject(value: unknown, depth = 0): SchemaVideoObject | null {
  if (depth > 6 || value == null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoObject(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const node = value as Record<string, unknown>;
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  if (types.includes('VideoObject')) return node;
  for (const key of ['@graph', 'video', 'mainEntity', 'mainEntityOfPage']) {
    if (key in node) {
      const found = findVideoObject(node[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** Read the page's first schema.org VideoObject (via its JSON-LD blocks), if any. */
function schemaVideoObject(html: string): SchemaVideoObject | null {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const found = findVideoObject(JSON.parse(block[1] ?? ''));
      if (found) return found;
    } catch {
      // A malformed block is not fatal — try the next one.
    }
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string') ?? null;
  return null;
}

/**
 * Desi Hub's platform, which it shares with its sibling sites.
 *
 * A Next.js grid of `/post/<slug>` cards where every post ships a schema.org
 * `VideoObject` carrying a `video.downloaddirect.xyz` mp4. One factory, several
 * sites — a sibling source is a new entry here, not a second copy of this parser.
 */
function makeDesiHubPlatform(config: {
  id: string;
  name: string;
  baseUrl: string;
  /** Width ÷ height of this site's posters; they differ slightly between siblings. */
  thumbnailAspect: number;
  /** Requests per second this site tolerates (see `SourceAdapter.requestDelayMs`). */
  requestDelayMs?: number;
}): SourceAdapter {
  const { id, name, baseUrl, thumbnailAspect, requestDelayMs } = config;
  return {
    id,
    name,
    baseUrl,
    thumbnailAspect,
    ...(requestDelayMs ? { requestDelayMs } : {}),
    listingUrl: (page) => (page <= 1 ? `${baseUrl}/` : `${baseUrl}/page/${page}`),
    needsPostFetch: true,
    parseListing(html, pageUrl) {
      // The listing is a Next.js grid of <a href="/post/<slug>"> cards. The visible
      // title lives in the card's <h3> (the poster's alt text carries a longer
      // variant) and posters are wrapped by Next's image optimizer. Cards themselves
      // are huge (two <img> tags with ten-entry srcSets each), so anchors are located
      // by index and each card's slice runs up to the next post link.
      const positions: { url: string; index: number }[] = [];
    const seen = new Set<string>();
      const re = /href=["'](\/post\/[a-z0-9-]+)["']/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(html)) !== null) {
        const absolute = absoluteUrl(match[1] ?? '', pageUrl);
        if (seen.has(absolute)) continue;
        seen.add(absolute);
        positions.push({ url: absolute, index: match.index });
      }

      return positions.map((hit, index) => {
        const end = index + 1 < positions.length ? positions[index + 1]!.index : hit.index + 12_000;
        const block = html.slice(hit.index, end);
        const slug = hit.url.split('/').pop() ?? hit.url;
        const title =
          stripTags(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? '')
          || stripTags(block.match(/alt=["']Featured image for ([^"']*)["']/i)?.[1] ?? '')
          || slugToTitle(slug);
        return makeEntry({
          pageUrl: hit.url,
          title,
          thumbnailUrl: decodeNextImage(block),
          tags: ['desi'],
        });
      });
    },
    enrich(entryItem, html) {
      // Every post ships a schema.org VideoObject carrying the CDN mp4, the frame,
      // the poster, the writer's own description and — crucially — the original
      // upload date, so a backfill keeps the site's real chronology. The direct file
      // is indexed first: a native <video> is far more reliable than framing another
      // site, and it means the card actually plays.
      const schema = schemaVideoObject(html);
      const mp4 =
        asString(schema?.contentUrl)
        ?? html.match(/https:\/\/video\.downloaddirect\.xyz\/[^"'\s\\]+\.mp4/i)?.[0]
        ?? null;
      const frame = asString(schema?.embedUrl) ?? bestIframe(html, baseUrl);
      const poster =
        asString(schema?.thumbnailUrl)
        ?? html.match(/https:\/\/images\.downloaddirect\.xyz\/[^"'&\s]+\.(?:webp|jpg|png)/i)?.[0]
        ?? metaContent(html, 'og:image');
      const description = asString(schema?.description) ?? metaContent(html, 'og:description');
      return {
        ...entryItem,
        title: stripTags(asString(schema?.name) ?? '') || entryItem.title || `${name} video`,
        description: description ?? entryItem.description,
        publishedAt: asString(schema?.uploadDate) ?? entryItem.publishedAt,
        thumbnailUrl: entryItem.thumbnailUrl ?? poster ?? null,
        embedUrl: mp4 ?? frame ?? null,
        embedType: mp4 ? 'video' : frame ? 'iframe' : 'link',
      };
    },
  };
}

/**
 * Desi Hub and Desi Babe.
 *
 * Desi Hub's stills measured 760x1352, 940x1477, 960x1639, 3072x4096 — portrait,
 * roughly 3:4 to 2:3. Desi Babe's run a touch narrower (828x1351 sampled).
 */
const desihub = makeDesiHubPlatform({
  id: 'desihub',
  name: 'Desi Hub',
  baseUrl: 'https://desihub.sh',
  thumbnailAspect: 3 / 4,
});

const desibabe = makeDesiHubPlatform({
  id: 'desibabe',
  name: 'Desi Babe',
  baseUrl: 'https://desibabe.co',
  thumbnailAspect: 0.61,
});

// ── enf-cmnf.cc — WordPress blog; post pages may be Cloudflare-protected ────

const enfcmnf: SourceAdapter = {
  id: 'enf-cmnf',
  name: 'ENF CMNF',
  baseUrl: 'https://enf-cmnf.cc',
  listingUrl: (page) => (page <= 1 ? 'https://enf-cmnf.cc/' : `https://enf-cmnf.cc/page/${page}/`),
  needsPostFetch: true,
  parseListing(html, pageUrl) {
    const found = new Map<string, string>();
    const re = /<a\b[^>]*href=["'](https:\/\/enf-cmnf\.cc\/\d{4}\/\d{2}\/[^"']+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const url = (match[1] ?? '').replace(/#[^#]*$/, '');
      if (found.has(url)) continue;
      found.set(url, stripTags(match[2] ?? ''));
    }
    const entries: ScrapedEntry[] = [];
    for (const [postUrl, label] of found) {
      const slug = postUrl.replace(/\/$/, '').split('/').pop() ?? postUrl;
      const win = windowAround(html, slug, 1600);
      entries.push(
        makeEntry({
          pageUrl: postUrl,
          title: label || slugToTitle(slug),
          thumbnailUrl: win.match(/https:\/\/cdn\.enf-cmnf\.cc\/[^"'\s]+\.(?:jpg|webp|png)/i)?.[0] ?? null,
          tags: ['enf'],
        }),
      );
    }
    return entries;
  },
  enrich(entryItem, html) {
    // A Cloudflare challenge page is small and titled "Just a moment…".
    const isChallenge = /just a moment/i.test(pageTitle(html) ?? '') && html.length < 20_000;
    const embedUrl = isChallenge ? null : bestIframe(html, 'https://enf-cmnf.cc');
    return {
      ...entryItem,
      embedUrl,
      embedType: embedUrl ? 'iframe' : 'link',
      title: entryItem.title || stripTags(metaContent(html, 'og:title') ?? '') || 'ENF/CMNF video',
      description: isChallenge ? entryItem.description : metaContent(html, 'og:description') ?? entryItem.description,
      thumbnailUrl: entryItem.thumbnailUrl ?? (isChallenge ? null : metaContent(html, 'og:image')),
    };
  },
};

// ── thedesidude.com — directory site; generic post-style adapter ────────────

const thedesidude: SourceAdapter = {
  id: 'thedesidude',
  name: 'The Desi Dude',
  baseUrl: 'https://thedesidude.com',
  listingUrl: (page) => (page <= 1 ? 'https://thedesidude.com/' : `https://thedesidude.com/page/${page}`),
  needsPostFetch: true,
  parseListing(html, pageUrl) {
    // The site is a directory of partner sites; index any post-style video
    // links it does publish (same shape as the other desi sites).
    const links = collectAnchors(html, /thedesidude\.com\/(post|video|clip)\/[^/?#]+$/i, pageUrl);
    const entries: ScrapedEntry[] = [];
    for (const [postUrl, label] of links) {
      const slug = postUrl.split('/').pop() ?? postUrl;
      entries.push(
        makeEntry({
          pageUrl: postUrl,
          title: label || slugToTitle(slug),
          thumbnailUrl: windowAround(html, slug, 1200).match(/https:\/\/[^"'\s]+\.(?:jpg|webp|png)/i)?.[0] ?? null,
          tags: ['desi'],
        }),
      );
    }
    return entries;
  },
  enrich(entryItem, html) {
    const embedUrl = bestIframe(html, 'https://thedesidude.com');
    return {
      ...entryItem,
      embedUrl,
      embedType: embedUrl ? 'iframe' : 'link',
      title: entryItem.title || stripTags(metaContent(html, 'og:title') ?? '') || 'TheDesiDude video',
      description: metaContent(html, 'og:description') ?? entryItem.description,
      thumbnailUrl: entryItem.thumbnailUrl ?? metaContent(html, 'og:image'),
    };
  },
};

// ── The "CDN post" platform (aamchor family) ────────────────────────────────

/**
 * The platform Aditi Mistry and Lucky Rajor run on, and their siblings.
 *
 * A Next.js app of `/videos/<slug>` pages, each with a schema.org `VideoObject`
 * whose `contentUrl` is a direct mp4 on the site's own CDN (`cdn.<host>/…/video.mp4`)
 * plus a matching `thumbnail.jpg` — and a real `uploadDate`. No iframe and no
 * signed token, so these play in a plain `<video>` and keep their true dates.
 */
function makeCdnPostPlatform(config: {
  id: string;
  name: string;
  baseUrl: string;
  /** Listing page for pagination index n (1-based). */
  listingUrl: (page: number) => string;
  /** Width ÷ height, if the site's posters aren't 16:9. */
  thumbnailAspect?: number;
  requestDelayMs?: number;
}): SourceAdapter {
  const { id, name, baseUrl, listingUrl, thumbnailAspect, requestDelayMs } = config;
  return {
    id,
    name,
    baseUrl,
    listingUrl,
    needsPostFetch: true,
    ...(thumbnailAspect ? { thumbnailAspect } : {}),
    ...(requestDelayMs ? { requestDelayMs } : {}),
    parseListing(html, pageUrl) {
      // `/videos/<slug>` links, skipping the site's own filter/pagination routes.
      const positions: { url: string; index: number }[] = [];
      const seen = new Set<string>();
      const re = /href=["'](\/videos\/[A-Za-z0-9._-]+)["']/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(html)) !== null) {
        const path = match[1] ?? '';
        if (/^\/videos\/(filter|page|tag|categor)/i.test(path)) continue;
        const absolute = absoluteUrl(path, pageUrl);
        if (seen.has(absolute)) continue;
        seen.add(absolute);
        positions.push({ url: absolute, index: match.index });
      }

      return positions.map((hit, index) => {
        const end = index + 1 < positions.length ? positions[index + 1]!.index : hit.index + 6_000;
        const block = html.slice(hit.index, end);
        const slug = hit.url.split('/').pop() ?? hit.url;
        const poster = block.match(/https:\/\/cdn\.[^"'\s\\)]+\.(?:jpg|jpeg|webp|png)/i)?.[0] ?? null;
        const title =
          stripTags(block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)?.[1] ?? '')
          || stripTags(block.match(/alt=["']([^"']{4,120})["']/i)?.[1] ?? '')
          || slugToTitle(slug);
        return makeEntry({ pageUrl: hit.url, title, thumbnailUrl: poster, tags: ['desi'] });
      });
    },
    enrich(entryItem, html) {
      const schema = schemaVideoObject(html);
      // Fallback without JSON-LD: the CDN's own naming is predictable.
      const mp4 =
        asString(schema?.contentUrl)
        ?? html.match(/https:\/\/cdn\.[^"'\s\\)]+\/[^"'\s\\)]*\.mp4/i)?.[0]
        ?? null;
      const poster =
        asString(schema?.thumbnailUrl)
        ?? html.match(/https:\/\/cdn\.[^"'\s\\)]+\.(?:jpg|jpeg|webp|png)/i)?.[0]
        ?? metaContent(html, 'og:image');
      const frame = asString(schema?.embedUrl) ?? bestIframe(html, baseUrl);
      const heading = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
      return {
        ...entryItem,
        title: stripTags(asString(schema?.name) ?? '') || heading || entryItem.title || `${name} video`,
        description: asString(schema?.description) ?? metaContent(html, 'og:description') ?? entryItem.description,
        publishedAt: asString(schema?.uploadDate) ?? entryItem.publishedAt,
        thumbnailUrl: entryItem.thumbnailUrl ?? poster ?? null,
        embedUrl: mp4 ?? frame ?? null,
        embedType: mp4 ? 'video' : frame ? 'iframe' : 'link',
      };
    },
  };
}

const aditimistry = makeCdnPostPlatform({
  id: 'aditimistry',
  name: 'Aditi Mistry',
  // The canonical host redirects to .xyz; pointing at the final host skips a hop.
  baseUrl: 'https://aditimistry.xyz',
  listingUrl: (page) => (page <= 1 ? 'https://aditimistry.xyz/videos' : `https://aditimistry.xyz/videos/filter/views/all/${page}`),
});

// Measured: `?page=2` re-serves page 1 (0 new links), while `/page/2` yields 28 new
// ones. Same platform, different pager — worth checking per site rather than
// assuming the sibling's query string.
const luckyrajor = makeCdnPostPlatform({
  id: 'luckyrajor',
  name: 'Lucky Rajor',
  baseUrl: 'https://luckyrajor.net',
  listingUrl: (page) => (page <= 1 ? 'https://luckyrajor.net/videos' : `https://luckyrajor.net/page/${page}`),
});

const poonampandey = makeCdnPostPlatform({
  id: 'poonampandey',
  name: 'Poonam Pandey',
  baseUrl: 'https://poonampandey.cc',
  listingUrl: (page) => (page <= 1 ? 'https://poonampandey.cc/videos' : `https://poonampandey.cc/page/${page}`),
});

export const SOURCE_ADAPTERS: SourceAdapter[] = [
  // Order matters only for a run's per-source budget, which is per source, so this
  // is just a reading order: the biggest contributors first.
  desihub,
  desibabe,
  videocelebs,
  aditimistry,
  luckyrajor,
  poonampandey,
  aznude,
  enfcmnf,
  thedesidude,
];
