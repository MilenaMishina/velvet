import type { DegradedReason } from '@/lib/youtube/models';

export type YouTubeErrorCode =
  | 'NOT_CONFIGURED'
  | 'QUOTA_EXCEEDED'
  | 'QUOTA_GUARD'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'UPSTREAM';

/** Every failure that leaves our YouTube layer is normalised into this shape. */
export class YouTubeApiError extends Error {
  readonly code: YouTubeErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly detail?: string;

  constructor(
    code: YouTubeErrorCode,
    message: string,
    options: { status?: number; retryable?: boolean; detail?: string } = {},
  ) {
    super(message);
    this.name = 'YouTubeApiError';
    this.code = code;
    this.status = options.status ?? httpStatusFor(code);
    this.retryable = options.retryable ?? (code === 'RATE_LIMITED' || code === 'UPSTREAM');
    this.detail = options.detail;
  }
}

export function httpStatusFor(code: YouTubeErrorCode): number {
  switch (code) {
    case 'NOT_CONFIGURED':
      return 503;
    case 'QUOTA_EXCEEDED':
    case 'QUOTA_GUARD':
      return 429;
    case 'RATE_LIMITED':
      return 429;
    case 'NOT_FOUND':
      return 404;
    case 'INVALID_REQUEST':
      return 400;
    default:
      return 502;
  }
}

export function isYouTubeApiError(error: unknown): error is YouTubeApiError {
  return error instanceof YouTubeApiError;
}

/** True when the app can't spend any more quota right now. */
export function isQuotaError(error: unknown): boolean {
  return isYouTubeApiError(error) && (error.code === 'QUOTA_EXCEEDED' || error.code === 'QUOTA_GUARD');
}

export function toDegradedReason(code: YouTubeErrorCode): DegradedReason {
  switch (code) {
    case 'QUOTA_EXCEEDED':
      return 'quota-exceeded';
    case 'QUOTA_GUARD':
      return 'quota-guard';
    case 'NOT_CONFIGURED':
      return 'not-configured';
    default:
      return 'upstream-error';
  }
}

/** Copy shown to users when we degrade — friendly, never a stack trace. */
export function friendlyMessage(code: YouTubeErrorCode): string {
  switch (code) {
    case 'NOT_CONFIGURED':
      return 'Add a YouTube API key to .env.local to start streaming discoveries.';
    case 'QUOTA_EXCEEDED':
    case 'QUOTA_GUARD':
      return "Today's YouTube API quota is used up. Showing the freshest cached picks until it resets.";
    case 'RATE_LIMITED':
      return 'YouTube is rate limiting us for a moment. Trying again shortly.';
    case 'NOT_FOUND':
      return "We couldn't find that on YouTube — it may be private or removed.";
    default:
      return 'YouTube is having a moment. We are showing what we already had.';
  }
}
