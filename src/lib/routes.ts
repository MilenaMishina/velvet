import type { TubeSort } from '@/lib/tube/models';
import { toQuery } from '@/lib/utils';
import type { DurationFilter, SearchOrder, UploadWindow } from '@/lib/youtube/models';

/**
 * Single source of truth for internal URLs. Keeping them here means a route
 * rename is one edit, and every link is type-checked at the call site.
 */

export interface SearchLinkParams {
  q: string;
  order?: SearchOrder;
  duration?: DurationFilter;
  uploaded?: UploadWindow;
}

export const routes = {
  home: '/',
  login: '/login',
  signup: '/signup',
  admin: '/admin',
  /** Most-viewed across every source we index — our own ranking, not YouTube's. */
  trending: '/trending',
  /** Opens a uniformly random scene. */
  random: '/random',
  /** The whole tag cloud. */
  tags: '/tags',
  /** Directory of every indexed site. */
  sources: '/sources',
  legal: {
    about: '/about',
    terms: '/terms',
    privacy: '/privacy',
    dmca: '/dmca',
    '2257': '/2257',
    contact: '/contact',
  },
  category: (slug: string) => `/category/${encodeURIComponent(slug)}`,
  watch: (videoId: string) => `/watch?v=${encodeURIComponent(videoId)}`,
  channel: (channelId: string) => `/channel/${encodeURIComponent(channelId)}`,
  playlist: (playlistId: string) => `/playlist/${encodeURIComponent(playlistId)}`,
  library: (list?: 'watchLater' | 'favorites' | 'history') => (list ? `/library?list=${list}` : '/library'),
  search: ({ q, order, duration, uploaded }: SearchLinkParams) =>
    `/search${toQuery({
      q,
      // Defaults are omitted so shared links stay short and cache keys collapse.
      order: order && order !== 'relevance' ? order : undefined,
      duration: duration && duration !== 'any' ? duration : undefined,
      uploaded: uploaded && uploaded !== 'any' ? uploaded : undefined,
    })}`,
  /**
   * Indexed-video surfaces (`/videos`) — the rows the tube sync pulls from the
   * partner sites. They get their own URL space rather than borrowing the
   * YouTube-shaped routes above, since playback there is the publisher's player.
   */
  tube: {
    index: '/videos',
    watch: (id: string) => `/videos/${encodeURIComponent(id)}`,
    filtered: (params: { source?: string; q?: string; sort?: TubeSort; tag?: string }) =>
      `/videos${toQuery({
        source: params.source,
        q: params.q,
        tag: params.tag,
        // `newest` is the default, so it stays out of the URL.
        sort: params.sort && params.sort !== 'newest' ? params.sort : undefined,
      })}`,
    tag: (tag: string) => `/videos?tag=${encodeURIComponent(tag)}`,
  },
} as const;

/** Canonical YouTube links, always shown so creators keep their attribution. */
export const youtube = {
  watch: (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`,
  channel: (channelId: string) => `https://www.youtube.com/channel/${channelId}`,
  playlist: (playlistId: string) => `https://www.youtube.com/playlist?list=${playlistId}`,
} as const;
