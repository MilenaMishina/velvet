import { cn } from '@/lib/utils';

/**
 * Shimmering placeholder block. Compose these into the *actual* shape of the
 * content that is loading (see `VideoGridSkeleton`) so the layout never jumps.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton', className)} {...props} />;
}
