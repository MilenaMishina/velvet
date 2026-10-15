/**
 * Display formatters. Locale is pinned to `en-US` so server-rendered markup and
 * client hydration always agree (a floating locale is a classic hydration bug).
 */

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-US');
const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/** 1234 → "1.2K", 5400000 → "5.4M". */
export function formatCompactNumber(value: number | string | undefined | null): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  if (n < 1000) return plain.format(n);
  return compact.format(n).replace(/\.0([KMBT])/, '$1');
}

export function formatExactNumber(value: number | string | undefined | null): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  return plain.format(n);
}

export function formatViews(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'No view data';
  return `${formatCompactNumber(value)} ${value === 1 ? 'view' : 'views'}`;
}

export function formatSubscribers(value: number | undefined | null, hidden?: boolean): string {
  if (hidden || value === undefined || value === null) return 'Subscribers hidden';
  return `${formatCompactNumber(value)} subscribers`;
}

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

/** ISO timestamp → "3 days ago". */
export function formatRelativeTime(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  let duration = (then - now) / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relative.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return '';
}

/** ISO timestamp → "Aug 26, 2026". */
export function formatAbsoluteDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : absolute.format(date);
}

/** Seconds → "9:41" / "1:02:33". */
export function formatDuration(totalSeconds: number | undefined | null): string {
  if (totalSeconds === undefined || totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '';
  }
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(seconds).padStart(2, '0')}`
    : `${mm}:${String(seconds).padStart(2, '0')}`;
}

/** Accessible duration label: "9 minutes 41 seconds". */
export function formatDurationLabel(totalSeconds: number | undefined | null): string {
  if (!totalSeconds) return 'Duration unavailable';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const seconds = Math.floor(totalSeconds % 60);
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (seconds && !hours) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 seconds';
}

/** ISO-8601 duration ("PT1H2M33S") → seconds. Returns null for live streams ("P0D"). */
export function parseIsoDuration(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso.trim());
  if (!match) return null;
  const [, d, h, m, s] = match;
  const seconds = Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  return seconds > 0 ? Math.round(seconds) : null;
}

/** Collapse a description to a single-line teaser. */
export function toTeaser(text: string | undefined | null, maxLength = 160): string {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1).trimEnd()}…` : flat;
}
