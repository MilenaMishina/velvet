/**
 * YouTube IFrame embed URLs.
 *
 * All playback in this app happens inside YouTube's official player — we never
 * touch a media stream. `youtube-nocookie.com` is used by default (privacy-enhanced
 * mode), which is also the only host besides youtube.com allowed by our CSP.
 */

const PRIVACY_HOST = 'https://www.youtube-nocookie.com';
const STANDARD_HOST = 'https://www.youtube.com';

export interface EmbedOptions {
  autoplay?: boolean;
  mute?: boolean;
  /** Seconds into the video to begin at. */
  start?: number;
  end?: number;
  controls?: boolean;
  loop?: boolean;
  /** Enables postMessage control (used by the watch page player). */
  jsApi?: boolean;
  /** Required by the IFrame API when jsApi is on; omit during SSR. */
  origin?: string;
  /** Set false to fall back to youtube.com (some videos restrict nocookie). */
  privacyMode?: boolean;
}

export function buildEmbedUrl(videoId: string, options: EmbedOptions = {}): string {
  const host = options.privacyMode === false ? STANDARD_HOST : PRIVACY_HOST;
  const url = new URL(`${host}/embed/${videoId}`);
  const params = url.searchParams;

  params.set('autoplay', options.autoplay ? '1' : '0');
  params.set('mute', options.mute ? '1' : '0');
  params.set('controls', options.controls === false ? '0' : '1');
  // Keep recommendations inside the current channel and drop YouTube's chrome.
  params.set('rel', '0');
  params.set('modestbranding', '1');
  params.set('playsinline', '1');
  params.set('iv_load_policy', '3');

  if (options.start && options.start > 0) params.set('start', String(Math.floor(options.start)));
  if (options.end && options.end > 0) params.set('end', String(Math.floor(options.end)));
  if (options.loop) {
    params.set('loop', '1');
    // A single-video loop still needs an explicit playlist of itself.
    params.set('playlist', videoId);
  }
  if (options.jsApi) params.set('enablejsapi', '1');
  if (options.origin) params.set('origin', options.origin);

  return url.toString();
}

/**
 * Where a hover preview should start: ~18% in, so we skip intros without landing
 * in the credits of a long video. Clamped to a sensible window.
 */
export function previewStartSeconds(durationSeconds: number | null): number {
  if (!durationSeconds || durationSeconds < 45) return 0;
  return Math.min(Math.max(Math.floor(durationSeconds * 0.18), 10), 240);
}

/** Attributes every embed iframe needs: the permissions YouTube's player expects. */
export const EMBED_IFRAME_PROPS = {
  allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
  referrerPolicy: 'strict-origin-when-cross-origin',
  allowFullScreen: true,
} as const;
