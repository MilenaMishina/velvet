/** How a scraped video plays on our watch page. */
export type TubeEmbedType =
  /** Third-party player page we can frame directly. */
  | 'iframe'
  /** Direct mp4/HLS file from the source CDN — played with a native <video>. */
  | 'video'
  /** No embeddable player found (e.g. Cloudflare-blocked page) — link out. */
  | 'link';

export type TubeStatus = 'published' | 'hidden';

export interface TubeVideo {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  embedType: TubeEmbedType;
  /** Canonical page on the source site — always linked for attribution. */
  pageUrl: string;
  durationSeconds: number | null;
  tags: string[];
  publishedAt: string | null;
  scrapedAt: string;
  views: number;
  /**
   * Width ÷ height of this source's posters, so a card can be shaped like the
   * artwork instead of cropping it. Sources differ wildly — Desi Hub publishes
   * portrait (~2:3) stills while Video Celebs uses landscape 4:3 and 16:9 — and
   * forcing everything into 16:9 decapitates half the catalogue.
   */
  aspectRatio: number;
  commentCount: number;
  /**
   * Operator-pinned. Pinned rows are carried at the top of the home page so the
   * front page stays editorial rather than purely chronological.
   */
  pinned: boolean;
  status: TubeStatus;
}

export interface TubeFeedResult {
  items: TubeVideo[];
  page: number;
  perPage: number;
  total: number;
  hasMore: boolean;
}

export type TubeSort = 'newest' | 'views' | 'oldest';

/** How many pinned rows the home page will carry, oldest pin first. */
export const HOME_PIN_LIMIT = 8;

export interface SyncRunSummary {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  trigger: 'manual' | 'cron';
  status: 'running' | 'success' | 'error';
  added: number;
  updated: number;
  errors: number;
  perSource: Record<string, { added: number; updated: number; errors: number }>;
}
