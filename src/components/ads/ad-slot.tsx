'use client';

import * as React from 'react';

import { useAdConfig } from '@/components/ads/ad-config-provider';
import { adRuntime } from '@/components/ads/ad-runtime';
import {
  ADSTERRA_UNITS,
  AD_PLACEMENTS,
  JUICY_FILL_TIMEOUT_MS,
  adsterraSnippet,
  type AdPlacementName,
  type JuicyZone,
} from '@/lib/ads';
import { cn } from '@/lib/utils';

/** The queue JuicyAds' loader drains when it runs. */
function juicyQueue(): Array<{ adzone: number }> {
  const scope = window as unknown as { adsbyjuicy?: Array<{ adzone: number }> };
  scope.adsbyjuicy = scope.adsbyjuicy || [];
  return scope.adsbyjuicy;
}

/**
 * Did the zone fill?
 *
 * Measured on the container rather than on our own element, because the loader does
 * not fill the `<ins>` in place — it *replaces* it with its own frame. A check that
 * only looked inside our element therefore found it empty, declared the zone a
 * failure, and rendered the stand-in alongside a perfectly good ad. Watching the
 * container catches every shape of a fill: content written inside the element, the
 * element swapped out, or a frame added next to it.
 */
function zoneFilled(host: HTMLElement, ins: HTMLElement): boolean {
  if (ins.children.length > 0 || ins.innerHTML.trim().length > 0) return true;
  // Ours is the only child until the loader does something: anything else in here,
  // or our element having been detached, means the zone answered.
  return host.children.length > (ins.isConnected ? 1 : 0);
}

/**
 * Queue a zone and report whether it filled.
 *
 * The `<ins>` element is built with DOM calls and appended into a container React
 * renders empty, rather than being rendered as JSX. That is not a style choice: the
 * loader rewrites the element it fills, and React — which believes it owns an `<ins>`
 * with no children — then throws `removeChild` on its next update and takes the whole
 * page down with it. Handing the ad its own corner of the DOM keeps the two
 * reconcilers from arguing over the same nodes.
 *
 * Shared with the in-video overlay rather than written twice: this verdict is the only
 * thing standing between a filled slot and a stand-in, so a second copy would drift.
 */
export function useJuicyZone(zone: JuicyZone | null) {
  const [useStandIn, setUseStandIn] = React.useState(zone === null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!zone) {
      setUseStandIn(true);
      return;
    }
    const host = containerRef.current;
    if (!host) return;

    // A loader that already failed cannot fill this zone, so there is nothing to wait for.
    if (adRuntime.juicyLoaderFailed) {
      setUseStandIn(true);
      return;
    }

    const ins = document.createElement('ins');
    ins.id = zone.id;
    ins.className = 'adsbyjuicy adsbyjuicy-zone block max-w-full border-0';
    ins.setAttribute('data-width', String(zone.width));
    ins.setAttribute('data-height', String(zone.height));
    ins.setAttribute('aria-label', `Advertisement ${zone.label}`);
    ins.style.width = `${zone.width}px`;
    ins.style.height = `${zone.height}px`;
    host.appendChild(ins);

    // The loader fills by element id, so it is queued only once the element exists.
    juicyQueue().push({ adzone: Number(zone.id) });

    const timer = window.setTimeout(() => {
      if (zoneFilled(host, ins) && !adRuntime.juicyLoaderFailed) return;
      // Remove our element *before* React renders the stand-in, so the two never
      // appear in the container at the same time.
      ins.remove();
      setUseStandIn(true);
    }, JUICY_FILL_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      ins.remove();
    };
  }, [zone]);

  return { useStandIn, containerRef };
}

export interface AdSlotProps {
  placement: AdPlacementName;
  /** Layout lives with the caller — `hidden lg:flex` is how a slot picks a breakpoint. */
  className?: string;
  /** Pass null where a surrounding band already labels its units. */
  caption?: string | null;
}

/**
 * One ad slot: JuicyAds first, Adsterra only if that zone did not fill.
 *
 * The space is reserved while the zone is in flight, so a slot that never fills costs
 * a hole rather than a layout shift, and a JuicyAds unit that does fill is never
 * doubled up with a stand-in — the two are mutually exclusive by construction.
 */
export function AdSlot({ placement, className, caption }: AdSlotProps) {
  const config = useAdConfig();
  const spec = AD_PLACEMENTS[placement];
  // With no primary — because JuicyAds is switched off — Adsterra owns this slot from
  // the first paint rather than after a wait it cannot win.
  const zone = config.juicyAds ? spec.juicy : null;
  const { useStandIn, containerRef } = useJuicyZone(zone);

  if (!config.enabled) return null;

  const standIn = config.adsterraFallback && spec.fallback ? ADSTERRA_UNITS[spec.fallback] : null;
  const label = caption === null ? null : (caption ?? spec.caption);
  const reserved = zone ? { width: spec.width, height: spec.height } : standIn;
  if (!reserved) return null;

  return (
    <div
      role="complementary"
      aria-label={label ?? 'Advertisement'}
      className={cn('flex w-full flex-col items-center gap-1.5', className)}
    >
      <div
        ref={containerRef}
        className="relative flex items-center justify-center"
        style={{ minHeight: reserved.height }}
      >
        {useStandIn && standIn ? (
          <iframe
            title={`Advertisement ${standIn.label}`}
            srcDoc={adsterraSnippet(spec.fallback!)}
            width={standIn.width}
            height={standIn.height}
            loading="lazy"
            scrolling="no"
            className="block border-0"
            style={{ width: standIn.width, height: standIn.height, maxWidth: '100%' }}
          />
        ) : null}
      </div>
      {label ? <span className="text-2xs uppercase tracking-wider text-foreground-subtle">{label}</span> : null}
    </div>
  );
}

/**
 * The opening slot of the browsing pages: the leaderboard where there is room, the
 * phone-width unit where there is not. Two zones rather than one scaled unit, because
 * a 728px banner squeezed onto a phone earns nothing.
 */
export function AdLeadStrip({ className }: { className?: string }) {
  return (
    <div className={cn('flex w-full justify-center', className)}>
      <AdSlot placement="lead-wide" className="hidden sm:flex" />
      <AdSlot placement="lead-narrow" className="sm:hidden" />
    </div>
  );
}
