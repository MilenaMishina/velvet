import { VideoCard, type VideoCardVariant } from '@/components/video/video-card';
import { cn } from '@/lib/utils';
import type { AppVideo } from '@/lib/youtube/models';

export interface VideoGridProps {
  videos: AppVideo[];
  /** Give the first item a wide, editorial treatment (home / category heroes). */
  featureFirst?: boolean;
  /** Index offset so appended pages keep the stagger going instead of restarting. */
  indexOffset?: number;
  className?: string;
  showChannel?: boolean;
}

/**
 * Adaptive discovery grid.
 *
 * Card sizes deliberately vary: a featured item spans two columns so a feed reads
 * like an edited page rather than a uniform matrix. `grid-dense` lets the browser
 * backfill the gap that creates.
 */
export function VideoGrid({
  videos,
  featureFirst = false,
  indexOffset = 0,
  className,
  showChannel = true,
}: VideoGridProps) {
  return (
    <div
      className={cn(
        'grid-dense grid grid-cols-1 gap-x-5 gap-y-9 xs:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5',
        className,
      )}
    >
      {videos.map((video, position) => {
        const featured = featureFirst && indexOffset === 0 && position === 0;
        const variant: VideoCardVariant = featured ? 'featured' : 'default';
        return (
          <VideoCard
            key={video.id}
            video={video}
            variant={variant}
            index={indexOffset + position}
            // Only the first row is above the fold; everything else lazy-loads.
            priority={indexOffset === 0 && position < 2}
            showChannel={showChannel}
            className={featured ? 'xs:col-span-2' : undefined}
          />
        );
      })}
    </div>
  );
}

/** Vertical list used by the "More like this" rail and library sidebars. */
export function VideoList({
  videos,
  className,
  indexOffset = 0,
}: {
  videos: AppVideo[];
  className?: string;
  indexOffset?: number;
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {videos.map((video, position) => (
        <VideoCard key={video.id} video={video} variant="compact" index={indexOffset + position} />
      ))}
    </div>
  );
}
