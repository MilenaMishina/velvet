import { Skeleton } from '@/components/ui/skeleton';
import { VideoGridSkeleton } from '@/components/video/video-grid-skeleton';

/** Route-level loading state, shaped like a feed page. */
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-24 shrink-0 rounded-pill" />
        ))}
      </div>

      <VideoGridSkeleton count={12} featureFirst />
    </div>
  );
}
