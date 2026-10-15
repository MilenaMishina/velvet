import { TubeCard } from '@/components/tube/tube-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { TubeVideo } from '@/lib/tube/models';
import { cn } from '@/lib/utils';

/**
 * Masonry, not a row-aligned grid.
 *
 * Sources publish posters in different shapes — Desi Hub portrait (~3:4), Video
 * Celebs landscape 4:3 — so a fixed 16:9 grid crops one of them to ribbons. CSS
 * columns let every card take its own card's height instead, which is what mixed
 * shapes need. The trade-off is that columns fill top-to-bottom, so the ordering
 * reads down each column rather than across each row.
 */
const GRID_LAYOUT = 'columns-1 gap-x-5 xs:columns-2 lg:columns-3 2xl:columns-4 3xl:columns-5';

export interface TubeGridProps {
  videos: TubeVideo[];
  className?: string;
  /** Replaces the default column layout — used by the narrow "more like this" rail. */
  layout?: string;
}

/** Adaptive masonry of indexed videos. */
export function TubeGrid({ videos, className, layout }: TubeGridProps) {
  return (
    <div className={cn(layout ?? GRID_LAYOUT, className)}>
      {videos.map((video, index) => (
        <div key={video.id} className="mb-7 break-inside-avoid">
          <TubeCard video={video} priority={index < 2} />
        </div>
      ))}
    </div>
  );
}

/** Card-shaped placeholders so appending a page never shifts the layout. */
export function TubeGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn(GRID_LAYOUT, className)}>
      <span className="sr-only">Loading more videos…</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="mb-7 break-inside-avoid">
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-video w-full rounded-card" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-[88%]" />
              <Skeleton className="h-3 w-[52%]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
