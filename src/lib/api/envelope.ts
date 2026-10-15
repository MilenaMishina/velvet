import 'server-only';

import { NextResponse } from 'next/server';

import { cacheControlFor, type CacheResult } from '@/lib/cache';
import {
  friendlyMessage,
  isYouTubeApiError,
  toDegradedReason,
  type YouTubeErrorCode,
  YouTubeApiError,
} from '@/lib/youtube/errors';
import type { ApiEnvelope, ResponseMeta } from '@/lib/youtube/models';
import { snapshot } from '@/lib/youtube/quota';

/**
 * Every API route answers with the same envelope: `{ data, meta }`.
 *
 * `meta` tells the client whether the payload came from cache, how old it is,
 * how much daily quota is left, and — crucially — whether we are running in a
 * degraded mode so the UI can say so instead of silently showing stale content.
 */

export interface ApiErrorBody {
  error: { code: YouTubeErrorCode | 'BAD_REQUEST'; message: string };
  meta: ResponseMeta;
}

async function buildMeta(
  result: Pick<CacheResult<unknown>, 'status' | 'ageSeconds'>,
  degraded?: ResponseMeta['degraded'],
): Promise<ResponseMeta> {
  return {
    cache: result.status,
    ageSeconds: result.ageSeconds,
    quota: await snapshot(),
    ...(degraded ? { degraded } : {}),
  };
}

interface EnvelopeOptions<T> {
  ttlSeconds: number;
  /** Last-resort payload when YouTube is unreachable or the budget is spent. */
  fallback?: () => T | Promise<T>;
}

/**
 * Run a service call and serialise it.
 *
 * Quota exhaustion and upstream failures are *expected* states for this app, so
 * when a `fallback` is supplied we answer 200 with degraded metadata rather than
 * handing the UI an error to render.
 */
export async function serveEnvelope<T>(
  load: () => Promise<CacheResult<T>>,
  options: EnvelopeOptions<T>,
): Promise<NextResponse<ApiEnvelope<T> | ApiErrorBody>> {
  try {
    const result = await load();
    const body: ApiEnvelope<T> = { data: result.data, meta: await buildMeta(result) };
    return NextResponse.json(body, {
      headers: {
        // Stale entries are still useful, so let the CDN serve them while revalidating.
        'Cache-Control': cacheControlFor(options.ttlSeconds),
        'X-Cache-Status': result.status,
      },
    });
  } catch (error) {
    const apiError = isYouTubeApiError(error)
      ? error
      : new YouTubeApiError('UPSTREAM', 'Unexpected failure talking to YouTube.', {
          detail: error instanceof Error ? error.message : String(error),
        });

    if (apiError.code !== 'NOT_FOUND' && apiError.code !== 'INVALID_REQUEST' && options.fallback) {
      const degraded = { reason: toDegradedReason(apiError.code), message: friendlyMessage(apiError.code) };
      const body: ApiEnvelope<T> = {
        data: await options.fallback(),
        meta: await buildMeta({ status: 'bypass', ageSeconds: 0 }, degraded),
      };
      return NextResponse.json(body, {
        headers: { 'Cache-Control': 'no-store', 'X-Cache-Status': 'degraded' },
      });
    }

    return errorResponse(apiError);
  }
}

export async function errorResponse(error: YouTubeApiError): Promise<NextResponse<ApiErrorBody>> {
  const degraded = { reason: toDegradedReason(error.code), message: friendlyMessage(error.code) };
  const body: ApiErrorBody = {
    error: { code: error.code, message: friendlyMessage(error.code) },
    meta: await buildMeta({ status: 'bypass', ageSeconds: 0 }, degraded),
  };
  if (error.detail) console.warn(`[api] ${error.code}: ${error.detail}`);
  return NextResponse.json(body, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
}

export async function badRequest(message: string): Promise<NextResponse<ApiErrorBody>> {
  const body: ApiErrorBody = {
    error: { code: 'BAD_REQUEST', message },
    meta: await buildMeta({ status: 'bypass', ageSeconds: 0 }),
  };
  return NextResponse.json(body, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

/** Empty page payload used as a graceful fallback for every feed route. */
export function emptyPage<T>() {
  return () => ({ items: [] as T[], nextPageToken: null, totalResults: 0 });
}
