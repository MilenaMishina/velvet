import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EmptyState } from '@/components/feedback/empty-state';
import { SetupNotice } from '@/components/feedback/setup-notice';
import { CategoryChips } from '@/components/layout/category-chips';
import { PageHeader } from '@/components/layout/page-header';
import { InfiniteVideoFeed } from '@/components/video/infinite-video-feed';
import { loadFeed } from '@/lib/api/server-feed';
import { isYouTubeConfigured } from '@/lib/env';
import { resolveCategoryParam } from '@/lib/youtube/categories';
import { fallbackCategoryDirectory, getCategoryDirectory, getTrendingFeed } from '@/lib/youtube/service';

interface CategoryPageProps {
  params: { slug: string };
}

/** Rendered per request; the shared cache layer decides when to hit YouTube. */
export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: CategoryPageProps): Metadata {
  const category = resolveCategoryParam(params.slug);
  if (!category) return { title: 'Category' };
  return {
    title: category.title,
    description: `Popular ${category.title.toLowerCase()} videos, refreshed from YouTube’s trending chart.`,
  };
}

/**
 * Category feed.
 *
 * Uses the category-scoped `mostPopular` chart (1 unit). Categories YouTube does
 * not chart in this region fall back to a single cached search — see
 * `service/feed.ts`.
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const category = resolveCategoryParam(params.slug);
  if (!category) notFound();
  if (!isYouTubeConfigured) return <SetupNotice />;

  const [feed, directory] = await Promise.all([
    loadFeed(() => getTrendingFeed({ categoryId: category.id, maxResults: 24 })),
    getCategoryDirectory()
      .then((result) => result.data)
      .catch(() => fallbackCategoryDirectory()),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<>Category</>}
        title={category.title}
        description={`The most-watched ${category.title.toLowerCase()} videos in your region right now.`}
      />

      <CategoryChips categories={directory.curated} />

      <InfiniteVideoFeed
        source={{ kind: 'feed', category: category.slug }}
        initialItems={feed.items}
        initialPageToken={feed.nextPageToken}
        initialMeta={feed.meta}
        featureFirst
        emptyState={
          <EmptyState
            icon={Compass}
            title={`Nothing charting in ${category.title}`}
            description="YouTube doesn’t publish a popular chart for every category in every region. Try another category, or search for a topic directly."
          />
        }
      />
    </div>
  );
}
