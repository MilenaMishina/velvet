/** Small HTML-parsing helpers for the scraper (regex-based, no dependencies). */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * A real browser's Accept line, wildcard included.
 *
 * This is not cosmetic. videocelebs.net answers `Accept: text/html,application/xhtml+xml`
 * with the right page minus its player (36 KB instead of 39 KB, no iframe, no
 * flashvars) and the same URL with a browser's full preference list with the player
 * intact — a bot filter that keys on the header, reported as a perfectly normal 200.
 * Without the wildcard, a whole source silently indexes as "link only".
 */
const BROWSER_ACCEPT =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';

/**
 * Some sites' WAFs fingerprint TLS handshakes: a request that declares a browser
 * UA but arrives with Node's own TLS signature gets a blind 403, while the same
 * URL through curl's handshake passes. On a 403 we retry through curl — same
 * headers, different transport — before giving up.
 */
async function fetchViaCurl(url: string, timeoutMs: number): Promise<string> {
  const { stdout } = await execFileAsync(
    'curl',
    [
      '-s', '-L', '--compressed',
      '--max-time', String(Math.ceil(timeoutMs / 1000)),
      '-A', DEFAULT_UA,
      '-H', `Accept: ${BROWSER_ACCEPT}`,
      '-H', 'Accept-Language: en-US,en;q=0.9',
      url,
    ],
    { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
  );
  return stdout;
}

/** Fetch a page as text with a browser UA and a hard timeout. */
export async function fetchPage(url: string, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: BROWSER_ACCEPT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      cache: 'no-store',
    });
    if (response.status === 403) {
      // TLS-fingerprint block: retry through curl before failing the source.
      return await fetchViaCurl(url, timeoutMs);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Extract an attribute value from a raw tag string. */
export function tagAttr(tag: string, attr: string): string | null {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeEntities(match[1] ?? '') : null;
}

/** First <meta name/property="x" content="y"> match. */
export function metaContent(html: string, name: string): string | null {
  const match = html.match(
    new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
  ) ?? html.match(
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i'),
  );
  return match ? decodeEntities(match[1] ?? '') : null;
}

export function pageTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1] ?? '') : null;
}

/** A ±size window of raw HTML around the first occurrence of `needle`. */
export function windowAround(html: string, needle: string, size = 1400): string {
  const index = html.indexOf(needle);
  if (index === -1) return '';
  const start = Math.max(0, index - size / 2);
  return html.slice(start, start + size);
}

/** Parse "MM:SS" or "HH:MM:SS" into seconds. */
export function matchDuration(text: string): number | null {
  const match = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (!match) return null;
  if (match[3] !== undefined) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "shraddha-kapoor-nude-haider-2014.html" → "Shraddha Kapoor Nude Haider 2014". */
export function slugToTitle(slug: string): string {
  return decodeEntities(
    slug
      .replace(/\.(html?|php)$/, '')
      .replace(/[-_+]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' '),
  ).replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeDurationSeconds(seconds: number | null): number | null {
  return seconds != null && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : null;
}

/** Resolve a possibly-relative URL against a base. */
export function absoluteUrl(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}
