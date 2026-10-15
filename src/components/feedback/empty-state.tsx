import type { LucideIcon } from 'lucide-react';
import { SearchX } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

/** Neutral, reassuring placeholder for "nothing here yet" — never an error tone. */
export function EmptyState({ title, description, icon: Icon = SearchX, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'panel flex flex-col items-center gap-3 rounded-card px-6 py-16 text-center shadow-soft',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-surface-raised text-foreground-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
      {description ? <p className="max-w-md text-sm text-foreground-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
