import 'server-only';

import { isYouTubeConfigured, serverEnv } from '@/lib/env';
import { sleep } from '@/lib/utils';
import { YouTubeApiError } from '@/lib/youtube/errors';
import { markExhausted, type QuotaOperation, reserve } from '@/lib/youtube/quota';
import type { YouTubeErrorBody } from '@/lib/youtube/types';

const API_ROOT = 'https://www.googleapis.com/youtube/v3';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

/** Reasons Google uses when the daily allowance is gone. */
const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded', 'servingLimitExceeded']);
const RATE_LIMIT_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'backendError']);

export type YouTubeParams = Record<string, string | number | boolean | undefined | null>;

interface CallOptions {
  /** Declared cost bucket — the quota governor reserves before we hit the wire. */
  operation: QuotaOperation;
  params: YouTubeParams;
}

function buildUrl(endpoint: string, params: YouTubeParams): string {
  const url = new URL(`${API_ROOT}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set('key', serverEnv.youtube.apiKey);
  return url.toString();
}

/** Never let a key leak into logs or error messages. */
function redact(url: string): string {
  return url.replace(/([?&]key=)[^&]+/, '$1REDACTED');
}

async function classify(response: Response, endpoint: string): Promise<YouTubeApiError> {
  let body: YouTubeErrorBody | null = null;
  try {
    body = (await response.json()) as YouTubeErrorBody;
  } catch {
    /* non-JSON error body — fall through to status-based classification */
  }
  const reason = body?.error?.errors?.[0]?.reason ?? '';
  const message = body?.error?.message ?? response.statusText;

  if (response.status === 403 && QUOTA_REASONS.has(reason)) {
    // Google is the authority: stop spending for the rest of the day.
    await markExhausted();
    return new YouTubeApiError('QUOTA_EXCEEDED', `YouTube quota exhausted (${endpoint}).`, { detail: message });
  }
  if (response.status === 429 || RATE_LIMIT_REASONS.has(reason)) {
    return new YouTubeApiError('RATE_LIMITED', `YouTube is rate limiting ${endpoint}.`, {
      retryable: true,
      detail: message,
    });
  }
  if (response.status === 404) {
    return new YouTubeApiError('NOT_FOUND', `YouTube has no resource for ${endpoint}.`, { detail: message });
  }
  if (response.status === 400) {
    return new YouTubeApiError('INVALID_REQUEST', `YouTube rejected the ${endpoint} request.`, { detail: message });
  }
  if (response.status === 403) {
    return new YouTubeApiError('INVALID_REQUEST', `YouTube forbade the ${endpoint} request (${reason || 'forbidden'}).`, {
      status: 403,
      detail: message,
    });
  }
  return new YouTubeApiError('UPSTREAM', `YouTube ${endpoint} failed with ${response.status}.`, {
    retryable: response.status >= 500,
    detail: message,
  });
}

/**
 * Single entry point to the YouTube Data API.
 *
 * - reserves quota up front (throws before spending when the budget is gone)
 * - retries transient failures with exponential backoff + jitter
 * - normalises every failure into `YouTubeApiError`
 */
export async function callYouTube<T>(endpoint: string, { operation, params }: CallOptions): Promise<T> {
  if (!isYouTubeConfigured) {
    throw new YouTubeApiError('NOT_CONFIGURED', 'YOUTUBE_API_KEY is not set.');
  }

  await reserve(operation);
  const url = buildUrl(endpoint, params);
  let lastError: YouTubeApiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        // We run our own SWR cache; Next's fetch cache would double-store payloads.
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) return (await response.json()) as T;

      lastError = await classify(response, endpoint);
    } catch (error) {
      const aborted = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      lastError = new YouTubeApiError('UPSTREAM', aborted ? `YouTube ${endpoint} timed out.` : `YouTube ${endpoint} is unreachable.`, {
        retryable: true,
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    if (!lastError.retryable || attempt === MAX_ATTEMPTS) break;
    // 400ms, 800ms … plus jitter, so parallel instances don't retry in lockstep.
    await sleep(2 ** (attempt - 1) * 400 + Math.random() * 200);
  }

  console.warn(`[youtube] ${redact(url)} → ${lastError?.code}: ${lastError?.detail ?? lastError?.message}`);
  throw lastError ?? new YouTubeApiError('UPSTREAM', `YouTube ${endpoint} failed.`);
}
