'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-[transform,background-color,color,box-shadow,border-color] duration-200 ease-spring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'brand-gradient text-primary-foreground shadow-glow hover:brightness-110',
        solid: 'bg-foreground text-background hover:bg-foreground/90',
        outline: 'panel text-foreground hover:border-border-strong hover:bg-surface-raised',
        ghost: 'text-foreground-muted hover:bg-surface-raised hover:text-foreground',
        subtle: 'bg-surface-raised/70 text-foreground hover:bg-surface-raised',
        danger: 'bg-danger/15 text-danger hover:bg-danger/25',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-10 px-4 text-sm [&_svg]:size-4',
        lg: 'h-12 px-6 text-base [&_svg]:size-5',
        icon: 'size-10 [&_svg]:size-[1.15rem]',
        'icon-sm': 'size-8 [&_svg]:size-4',
      },
      pill: {
        true: 'rounded-pill',
        false: '',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md', pill: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the single child element (links, menu items) instead of a <button>. */
  asChild?: boolean;
}

/**
 * Base button. Icon-only variants must always carry an `aria-label` — enforced by
 * review rather than types, since the icon lives in `children`.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, pill, asChild = false, type, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      className={cn(buttonVariants({ variant, size, pill }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
});

export { buttonVariants };
