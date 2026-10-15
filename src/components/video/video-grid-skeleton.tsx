import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** One card-shaped placeholder: thumbnail, avatar, two text lines. */
function VideoCardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={cn('flex flex-col', wide && 'xs:col-span-2')}>
      <Skeleton className="aspect-video w-full rounded-card" />
      <div className="mt-3 flex gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-[92%]" />
          <Skeleton className="h-3.5 w-[64%]" />
          <Skeleton className="h-3 w-[42%]" />
        </div>
      </div>
    </div>
  );
}

export interface VideoGridSkeletonProps {
  count?: number;
  featureFirst?: boolean;
  className?: string;
}

/**
 * Loading state shaped like the real grid, so the layout doesn't shift when data
 * arrives. `aria-busy` + a polite live region keep screen readers informed.
 */
export function VideoGridSkeleton({ count = 12, featureFirst = false, className }: VideoGridSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'grid-dense grid grid-cols-1 gap-x-5 gap-y-9 xs:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5',
        className,
      )}
    >
      <span className="sr-only">Loading videos…</span>
      {Array.from({ length: count }, (_, index) => (
        <VideoCardSkeleton key={index} wide={featureFirst && index === 0} />
      ))}
    </div>
  );
}

/** Compact-row placeholders for the watch page rail. */
export function VideoListSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-4', className)}>
      <span className="sr-only">Loading recommendations…</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="aspect-video w-40 shrink-0 rounded-card sm:w-44" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-[94%]" />
            <Skeleton className="h-3.5 w-[58%]" />
            <Skeleton className="h-3 w-[40%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
