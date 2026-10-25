import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Section heading used at the top of every page.
 *
 * Large uppercase display type with the house heat-bar. The bar sits *above* the
 * title like a marquee ink stamp — one glance and every page announces itself
 * the same way, which is what makes a big wall of thumbnails feel branded
 * instead of generic.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-[0.22em]">
            <span className="heat-text">{eyebrow}</span>
          </p>
        ) : null}
        <h1 className="font-display text-[1.7rem] font-extrabold uppercase leading-tight tracking-[-0.01em] text-pretty sm:text-4xl">
          {title}
        </h1>
        <div aria-hidden className="heat-bar mt-1 h-1 w-14" />
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * Smaller heading for shelves inside a page ("Featured", "Trending now").
 *
 * Uppercase, heavy, and bracketed by a short gradient bar — the shelf titles on
 * premium tubes are always the loudest text on the page after the logo.
 */
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
        <h2 className="flex items-center gap-2.5 font-display text-[1.05rem] font-extrabold uppercase tracking-[0.04em]">
          {/* Shelf title mark. */}
          <span aria-hidden className="heat-bar h-[1.1rem] w-1 shrink-0" />
          {title}
        </h2>
        {description ? <p className="mt-1 text-xs text-foreground-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
