import { adsEnabled, nativeBanner } from '@/lib/ads';
import { cn } from '@/lib/utils';

/**
 * Native in-feed unit.
 *
 * Unlike the banner slots this one is plain server-rendered markup — the network's
 * loader fills a container with a fixed id, so it needs no client component and no
 * frame of its own. The container is emitted *before* the loader so the element it
 * looks for is in the document even if the script runs early, and it is labelled
 * "Sponsored" so a unit that reads like an article card is not mistaken for one of
 * ours.
 *
 * Use it once per page: the container id is unique per account, and a second copy
 * on the same page would never be filled.
 */
export function AdNative({ className }: { className?: string }) {
  if (!adsEnabled) return null;

  return (
    <div role="complementary" aria-label="Sponsored content" className={cn('space-y-2', className)}>
      <p className="text-center text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
        Sponsored
      </p>
      <div className="panel flex min-h-[8rem] items-center justify-center rounded-card p-3">
        <div id={nativeBanner.containerId} className="w-full" />
      </div>
      <script async data-cfasync="false" src={nativeBanner.src} />
    </div>
  );
}
