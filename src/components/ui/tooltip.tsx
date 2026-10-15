'use client';

import * as Primitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const TooltipProvider = Primitive.Provider;
export const TooltipRoot = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(function TooltipContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-[16rem] rounded-control bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-foreground shadow-lifted',
          'data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in data-[state=closed]:animate-fade-out',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
});

export interface TooltipProps {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentPropsWithoutRef<typeof Primitive.Content>['side'];
}

/** Convenience wrapper: `<Tooltip label="Save">{trigger}</Tooltip>`. */
export function Tooltip({ label, children, side = 'bottom' }: TooltipProps) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </TooltipRoot>
  );
}
