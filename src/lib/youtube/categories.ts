import type { AppCategory } from '@/lib/youtube/models';

/**
 * Curated browse rail.
 *
 * YouTube exposes ~30 assignable categories via `videoCategories.list`, but most
 * are noise for a discovery product. We hand-pick the ones worth a first-class
 * entry point, give them our own slugs (nice URLs) and icons, and still verify
 * the ids against the live `videoCategories.list` response at runtime.
 *
 * Category ids are stable across regions for these entries.
 */
export const CURATED_CATEGORIES: readonly AppCategory[] = [
  { slug: 'music', id: '10', title: 'Music', icon: 'music' },
  { slug: 'gaming', id: '20', title: 'Gaming', icon: 'gamepad' },
  { slug: 'tech', id: '28', title: 'Tech & Science', icon: 'cpu' },
  { slug: 'sports', id: '17', title: 'Sports', icon: 'trophy' },
  { slug: 'education', id: '27', title: 'Education', icon: 'graduation' },
  { slug: 'comedy', id: '23', title: 'Comedy', icon: 'laugh' },
  { slug: 'news', id: '25', title: 'News & Politics', icon: 'newspaper' },
  { slug: 'entertainment', id: '24', title: 'Entertainment', icon: 'sparkles' },
  { slug: 'film', id: '1', title: 'Film & Animation', icon: 'clapperboard' },
  { slug: 'howto', id: '26', title: 'How-to & Style', icon: 'wrench' },
  { slug: 'people', id: '22', title: 'People & Blogs', icon: 'users' },
  { slug: 'travel', id: '19', title: 'Travel & Events', icon: 'plane' },
  { slug: 'autos', id: '2', title: 'Autos & Vehicles', icon: 'car' },
  { slug: 'animals', id: '15', title: 'Pets & Animals', icon: 'paw' },
] as const;

const BY_SLUG = new Map(CURATED_CATEGORIES.map((category) => [category.slug, category]));
const BY_ID = new Map(CURATED_CATEGORIES.map((category) => [category.id, category]));

export function getCategoryBySlug(slug: string): AppCategory | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

export function getCategoryById(id: string | null | undefined): AppCategory | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/**
 * Resolve a route param that may be either our slug ("music") or a raw YouTube
 * category id ("10"), so both `/category/music` and `/category/10` work.
 */
export function resolveCategoryParam(param: string): AppCategory | undefined {
  return getCategoryBySlug(param) ?? getCategoryById(param);
}

/** Human label for any category id, falling back to the live API titles. */
export function labelForCategoryId(id: string | null | undefined, apiTitles?: Map<string, string>): string | null {
  if (!id) return null;
  return getCategoryById(id)?.title ?? apiTitles?.get(id) ?? null;
}
