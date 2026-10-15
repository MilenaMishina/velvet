import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-raised/80 text-foreground-muted',
        primary: 'bg-primary/15 text-primary',
        accent: 'bg-accent/15 text-accent',
        live: 'bg-danger text-white',
        warning: 'bg-warning/20 text-warning',
        overlay: 'bg-black/75 text-white backdrop-blur-sm',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
