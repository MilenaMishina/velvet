import { AlertTriangle, Info, KeyRound, TimerReset } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DegradedReason, ResponseMeta } from '@/lib/youtube/models';

const PRESET: Record<DegradedReason, { Icon: typeof Info; tone: string; label: string }> = {
  'quota-exceeded': {
    Icon: TimerReset,
    tone: 'border-warning/30 bg-warning/10 text-warning',
    label: 'Daily YouTube quota reached',
  },
  'quota-guard': {
    Icon: TimerReset,
    tone: 'border-warning/30 bg-warning/10 text-warning',
    label: 'Quota budget reached',
  },
  'upstream-error': {
    Icon: AlertTriangle,
    tone: 'border-danger/30 bg-danger/10 text-danger',
    label: 'YouTube is unreachable',
  },
  'not-configured': {
    Icon: KeyRound,
    tone: 'border-primary/30 bg-primary/10 text-primary',
    label: 'API key missing',
  },
};

/**
 * Tells the visitor *why* a surface looks thin — a spent quota is a normal state
 * for a project running on YouTube's free tier, not a crash, and saying so plainly
 * is better UX than an empty grid.
 */
export function DegradedNotice({ meta, className }: { meta: ResponseMeta | null | undefined; className?: string }) {
  const degraded = meta?.degraded;
  if (!degraded) return null;

  const preset = PRESET[degraded.reason];
  const resets = new Date(meta.quota.resetsAt);
  const showReset = degraded.reason === 'quota-exceeded' || degraded.reason === 'quota-guard';

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-card border px-4 py-3 text-sm shadow-soft',
        preset.tone,
        className,
      )}
    >
      <preset.Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">{preset.label}</p>
        <p className="text-foreground-muted">{degraded.message}</p>
        {showReset ? (
          <p className="text-xs text-foreground-subtle" suppressHydrationWarning>
            Quota resets {resets.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}{' '}
            (midnight Pacific).
          </p>
        ) : null}
      </div>
    </div>
  );
}
