import 'server-only';

import { cached, type CacheResult } from '@/lib/cache';
import { serverEnv } from '@/lib/env';
import { stableKey } from '@/lib/utils';
import { callYouTube } from '@/lib/youtube/client';
import { CURATED_CATEGORIES } from '@/lib/youtube/categories';
import type { AppCategory } from '@/lib/youtube/models';
import type { YouTubeListResponse, YouTubeVideoCategoryItem } from '@/lib/youtube/types';
import { TTL } from '@/lib/youtube/service/shared';

export interface CategoryDirectory {
  /** Our curated rail, filtered to the ids this region actually supports. */
  curated: AppCategory[];
  /** Every assignable category id → title, for labelling arbitrary videos. */
  titles: Record<string, string>;
}

/**
 * `videoCategories.list` costs 1 unit and changes about once a year, so it is
 * cached for a day. We use it to (a) label videos and (b) drop curated entries
 * that a given region doesn't support, instead of hard-coding assumptions.
 */
export async function getCategoryDirectory(regionCode?: string): Promise<CacheResult<CategoryDirectory>> {
  const region = regionCode ?? serverEnv.youtube.regionCode;

  return cached({
    key: stableKey('categories', { region }),
    ttlSeconds: TTL.static,
    loader: async () => {
      const response = await callYouTube<YouTubeListResponse<YouTubeVideoCategoryItem>>('videoCategories', {
        operation: 'videoCategories',
        params: { part: 'snippet', regionCode: region, hl: serverEnv.youtube.relevanceLanguage },
      });

      const titles: Record<string, string> = {};
      const available = new Set<string>();
      for (const item of response.items ?? []) {
        const title = item.snippet?.title;
        if (!title) continue;
        titles[item.id] = title;
        if (item.snippet?.assignable !== false) available.add(item.id);
      }

      const curated = CURATED_CATEGORIES.filter(
        (category) => available.size === 0 || available.has(category.id),
      ).map((category) => ({ ...category }));

      return { curated, titles } satisfies CategoryDirectory;
    },
  });
}

/** Never let the sidebar disappear just because the API hiccupped. */
export function fallbackCategoryDirectory(): CategoryDirectory {
  return {
    curated: CURATED_CATEGORIES.map((category) => ({ ...category })),
    titles: Object.fromEntries(CURATED_CATEGORIES.map((category) => [category.id, category.title])),
  };
}
