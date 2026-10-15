import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Section heading used at the top of every page. Generous whitespace and a large
 * display face are the main levers that keep a wall of thumbnails from feeling like
 * a wall.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-pretty sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Smaller heading for shelves inside a page ("More like this", "Playlists"). */
export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-foreground-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
