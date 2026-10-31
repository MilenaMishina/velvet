import type { ScrapedPost, ScrapedVideoItem, TubeEmbedType } from '../models';
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
  /**
   * Structured post parser for sources that publish whole posts (possibly several
   * videos and/or a photo gallery on one page). When present, the orchestrator
   * prefers its output over the legacy enrich flow and stores every video the post
   * carries as its own row.
   */
  parsePost?: (html: string, pageUrl: string) => ScrapedPost;
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

/**
 * Read a Desi Hub post page as structured truth: every VideoObject it ships (each
 * is its own playable clip with its own mp4, frame and title), plus its photo
 * gallery when the post is (or also is) a photo set.
 */
export function parseDesiHubPost(html: string, pageUrl: string, sourceName: string): ScrapedPost {
  const page = schemaWebPage(html);
  const videos = (page?.video ?? []) as unknown[];
  const images = (page?.image ?? []) as unknown[];

  const clipItems: ScrapedVideoItem[] = videos
    .map((node) => {
      const video = node as SchemaVideoObject;
      const mp4 = asString(video.contentUrl) ?? asString(video.embedUrl);
      const frame = firstString(video.thumbnailUrl);
      return {
        title: stripTags(asString(video.name) ?? '') || '',
        embedUrl: mp4,
        embedType: (mp4 ? 'video' : 'link') as TubeEmbedType,
        durationSeconds: null,
        thumbnailUrl: frame,
      };
  })
    .filter((item) => item.embedUrl);

  const gallery = images.filter((url): url is string => typeof url === 'string' && url.length > 0);
  const poster = firstString(page?.image) ?? clipItems[0]?.thumbnailUrl ?? gallery[0] ?? null;
  const postTitle = stripTags(asString(page?.name) ?? '') || slugToTitle(pageUrl.split('/').pop() ?? '');
  const postDate = firstString((page as { datePublished?: unknown } | null)?.datePublished);

  // A post with no videos is a photo set; with videos, the poster rides video[0]
  // and any remaining shots join the gallery so nothing the source published is lost.
  const galleryUrls = videos.length > 0 ? gallery.filter((url) => url !== poster) : gallery;

  return {
    pageUrl,
    title: postTitle,
    description: stripTags(asString(page?.description) ?? '') || null,
    tags: ['desi'],
    publishedAt: postDate,
    thumbnailUrl: poster,
    videos: clipItems,
    galleryUrls,
    embedType: clipItems.length > 0 ? 'video' : 'gallery',
    durationSeconds: null,
  };
}

/** First string in a JSON-LD value that may itself be an array of strings. */
function firstString(value: unknown): string | null {
  return asString(value);
}

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

/** The handful of WebPage fields we index from a post's JSON-LD. */
interface SchemaWebPage {
  name?: unknown;
  description?: unknown;
  image?: unknown;
  datePublished?: unknown;
  video?: unknown;
  /** References (`{ "@id": "…#gallery" }`) to the nodes that hold the real media. */
  mainEntity?: unknown;
  mainEntityOfPage?: unknown;
}

/**
 * The post's own WebPage node from its JSON-LD — not just its first VideoObject.
 * Desi Hub ships `video` as an ARRAY (one clip or several) and `image` as the post's
 * photo gallery, so reading only the VideoObject loses both. The node lives at
 * `@graph[0]` on this platform but the search is generic: the first object that
 * declares `@type: WebPage` wins.
 */
function schemaWebPage(html: string): SchemaWebPage | null {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const root: unknown = JSON.parse(block[1] ?? '');
      const found = findWebPage(root);
      if (found) return mergeLinkedMedia(found, root);
    } catch {
      // A malformed block is not fatal — try the next one.
    }
  }
  return null;
}

/** Index every node in a JSON-LD tree by its `@id`. */
function indexNodesById(value: unknown, into: Map<string, Record<string, unknown>>, depth = 0): void {
  if (depth > 8 || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) indexNodesById(item, into, depth + 1);
    return;
  }
  const node = value as Record<string, unknown>;
  const id = node['@id'];
  if (typeof id === 'string') {
    // A reference (`{ "@id": "…#gallery" }`) and the node it names share an id, and
    // the reference is walked first because it sits inside the WebPage. The real
    // node wins: it is the one carrying fields beyond the id.
    const existing = into.get(id);
    if (!existing || (Object.keys(existing).length <= 1 && Object.keys(node).length > 1)) {
      into.set(id, node);
    }
  }
  for (const key of Object.keys(node)) indexNodesById(node[key], into, depth + 1);
}

/**
 * Pull the media out of the nodes a post's WebPage points at.
 *
 * Desi Babe's platform splits a photo post across two nodes: the WebPage carries no
 * `image` at all, only `mainEntity: { "@id": "…/post/<slug>#gallery" }`, and the
 * ImageGallery node behind that id holds the whole set. Reading the WebPage alone
 * therefore saw "a post with neither a video nor a photo" for every one of those
 * sets — the exact shape that was being dropped instead of published.
 */
function mergeLinkedMedia(page: SchemaWebPage, root: unknown): SchemaWebPage {
  const merged: SchemaWebPage = { ...page };
  const byId = new Map<string, Record<string, unknown>>();
  indexNodesById(root, byId);

  for (const link of [page.mainEntity, page.mainEntityOfPage]) {
    const id = link && typeof link === 'object' ? (link as { '@id'?: unknown })['@id'] : undefined;
    if (typeof id !== 'string') continue;
    const node = byId.get(id);
    if (!node) continue;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    // A video post points straight at its own VideoObject, which *is* the clip —
    // there is no `video` field on it to read, so it has to be lifted as the post's
    // video list. Photo posts point at an ImageGallery whose `image` array is read
    // the same way as a WebPage that carries the set inline.
    if (types.includes('VideoObject')) {
      merged.video ??= [node];
    } else {
      merged.video ??= node.video;
      merged.image ??= node.image;
    }
    // A VideoObject dates itself with `uploadDate`; the WebPage with `datePublished`.
    merged.datePublished ??= node.datePublished ?? node.uploadDate;
    merged.description ??= node.description;
    merged.name ??= node.name;
  }

  return merged;
}

/** Depth-first search for the `@type: WebPage` node inside a parsed JSON-LD tree. */
function findWebPage(value: unknown, depth = 0): SchemaWebPage | null {
  if (depth > 6 || value == null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findWebPage(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const node = value as Record<string, unknown>;
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  if (types.includes('WebPage')) return node;
  for (const key of ['@graph', 'mainEntity']) {
    if (key in node) {
      const found = findWebPage(node[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}/**
 * Desi Hub's platform, which it shares with its sibling sites.
 *
 * A Next.js grid of `/post/<slug>` cards. Posts ship a schema.org WebPage whose
 * `video` field is an ARRAY of VideoObjects — a post can carry one clip or four,
 * each with its own mp4, title and frame — and photo-only posts publish an `image`
 * array with no videos at all. `parsePost` maps both shapes faithfully, so the
 * catalogue keeps every clip and every photo set the source publishes.
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
    // parsePost supersedes enrich for this platform; the base step stays because the
    // interface requires it and costs nothing.
    enrich: (entryItem) => entryItem,
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
    parsePost: (html, pageUrl) => parseDesiHubPost(html, pageUrl, name),
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

/**
 * Desi Babe's second domain — the same platform on desibabe.tv, catalogued as its
 * own source because the two sites publish different posts.
 */
const desibabetv = makeDesiHubPlatform({
  id: 'desibabetv',
  name: 'Desi Babe TV',
  baseUrl: 'https://desibabe.tv',
  thumbnailAspect: 0.61,
});

// ── enf-cmnf.cc — WordPress blog; native players, photo posts, text stories ─

/**
 * The post's own media region: everything before Jetpack's related-posts block
 * (`id='jp-relatedposts'`). Every cdn image beyond that marker belongs to a
 * different post — treating it as this post's gallery would fill video posts
 * with other videos' covers.
 */
function enfOwnRegion(html: string): string {
  const cut = html.search(/id=['"]jp-relatedposts['"/]/);
  return cut > -1 ? html.slice(0, cut) : html;
}

/**
 * Story detection. The blog also publishes erotic fiction — pure prose, no
 * video, maybe a stock illustration — and those must not become photo rows.
 * Two paragraphs of 200+ characters with no video is prose with certainty:
 * video and photo posts carry a sentence or two at most.
 */
function enfIsStory(region: string): boolean {
  let long = 0;
  for (const match of region.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    if (stripTags(match[1] ?? '').length >= 200) long += 1;
    if (long >= 2) return true;
  }
  return false;
}

/** Every self-hosted `<video>` player in the region — one item per mp4 source. */
function enfVideoClips(region: string): ScrapedVideoItem[] {
  const items: ScrapedVideoItem[] = [];
  for (const block of region.match(/<video\b[^>]*>[\s\S]*?<\/video>/gi) ?? []) {
    const src =
      block.match(/<source\s+src=["']([^"']+\.mp4)["']/i)?.[1]
      ?? block.match(/src=["']([^"']+\.mp4)["']/i)?.[1]
      ?? null;
    if (!src) continue;
    items.push({
      title: '',
      embedUrl: src,
      embedType: 'video',
      durationSeconds: null,
      thumbnailUrl: tagAttr(block, 'poster'),
    });
  }
  return items;
}

/**
 * The post's own photos. WordPress prints sized variants (`img-768x432.jpg`);
 * when the original exists, the variant is dropped. Icons and UI art excluded.
 */
function enfGallery(region: string): string[] {
  const all = new Set<string>();
  for (const match of region.matchAll(/https:\/\/cdn\.enf-cmnf\.cc\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp|gif)/gi)) {
    all.add(match[0]);
  }
  const originals = new Set<string>();
  for (const url of all) originals.add(url.replace(/-\d+x\d+(?=\.\w+$)/i, ''));
  // Keep a sized variant only when its full-size original is absent.
  return [...all]
    .filter((url) => !/cropped-/i.test(url))
    .filter((url) => {
      const base = url.replace(/-\d+x\d+(?=\.\w+$)/i, '');
      return base === url || !originals.has(base);
    });
}

const enfcmnf: SourceAdapter = {
  id: 'enf-cmnf',
  name: 'ENF CMNF',
  baseUrl: 'https://enf-cmnf.cc',
  listingUrl: (page) => (page <= 1 ? 'https://enf-cmnf.cc/' : `https://enf-cmnf.cc/page/${page}/`),
  needsPostFetch: true,
  parseListing(html, pageUrl) {
    // Strict slug URLs only: the loose `[^"']+` variant also swallowed share
    // links (`/2026/10/slug/?share=reddit`) and indexed the same post twice.
    const found = new Map<string, string>();
    const re = /<a\b[^>]*href=["'](https:\/\/enf-cmnf\.cc\/\d{4}\/\d{2}\/[a-z0-9-]+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
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
  parsePost(html, pageUrl) {
    const region = enfOwnRegion(html);
    const clips = enfVideoClips(region);
    const gallery = enfGallery(region);

    const rawTitle =
      stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
      || stripTags(metaContent(html, 'og:title') ?? '');
    const slug = pageUrl.replace(/\/$/, '').split('/').pop() ?? pageUrl;

    // First `<time datetime>` is the publish stamp (the second is modified);
    // normalised to UTC so it orders correctly against every other row.
    const timeRaw = html.match(/<time[^>]*datetime=["']([^"']+)["']/i)?.[1] ?? null;
    let publishedAt: string | null = null;
    if (timeRaw) {
      const parsed = new Date(timeRaw);
      if (!Number.isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
    }

    if (clips.length === 0) {
      // Stories are skipped outright — the operator does not index fiction.
      if (enfIsStory(region)) {
        return {
          pageUrl,
          title: rawTitle,
          description: null,
          tags: ['enf'],
          publishedAt,
          thumbnailUrl: null,
          videos: [],
          galleryUrls: [],
          embedType: 'link',
          durationSeconds: null,
        };
      }
      // A photo post: every own image becomes the gallery, head shot is the poster.
      return {
        pageUrl,
        title: rawTitle || slugToTitle(slug),
        description: stripTags(metaContent(html, 'og:description') ?? '') || null,
        tags: ['enf'],
        publishedAt,
        thumbnailUrl: gallery[0] ?? null,
        videos: [],
        galleryUrls: gallery,
        embedType: 'gallery',
        durationSeconds: null,
      };
    }

    return {
      pageUrl,
      title: rawTitle || slugToTitle(slug),
      description: stripTags(metaContent(html, 'og:description') ?? '') || null,
      tags: ['enf'],
      publishedAt,
      thumbnailUrl: clips[0]!.thumbnailUrl ?? gallery[0] ?? null,
      videos: clips,
      galleryUrls: gallery,
      embedType: 'video',
      durationSeconds: null,
    };
  },
  enrich: (entryItem) => entryItem,
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
  desibabetv,
  videocelebs,
  aditimistry,
  luckyrajor,
  poonampandey,
  aznude,
  enfcmnf,
  thedesidude,
];
