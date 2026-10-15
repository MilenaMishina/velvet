'use client';

import * as Primitive from '@radix-ui/react-scroll-area';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Custom scroll container used by the desktop sidebar. */
export const ScrollArea = React.forwardRef<
  React.ElementRef<typeof Primitive.Root>,
  React.ComponentPropsWithoutRef<typeof Primitive.Root>
>(function ScrollArea({ className, children, ...props }, ref) {
  return (
    <Primitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
      <Primitive.Viewport className="size-full rounded-[inherit] [&>div]:!block">
        {children}
      </Primitive.Viewport>
      <Primitive.Scrollbar
        orientation="vertical"
        className="flex w-2 touch-none select-none p-0.5 transition-opacity data-[state=hidden]:opacity-0"
      >
        <Primitive.Thumb className="flex-1 rounded-pill bg-border-strong/70" />
      </Primitive.Scrollbar>
      <Primitive.Corner />
    </Primitive.Root>
  );
});
