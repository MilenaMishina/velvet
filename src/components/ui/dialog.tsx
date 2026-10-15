'use client';

import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;

function Overlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof Primitive.Overlay>) {
  return (
    <Primitive.Overlay
      className={cn(
        'fixed inset-0 z-40 bg-surface-sunken/70 backdrop-blur-sm',
        'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
        className,
      )}
      {...props}
    />
  );
}

/** Left-anchored drawer, used for the mobile category sidebar. */
export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content> & { title: string }
>(function DrawerContent({ className, children, title, ...props }, ref) {
  return (
    <Primitive.Portal>
      <Overlay />
      <Primitive.Content
        ref={ref}
        className={cn(
          'nav-surface fixed inset-y-0 left-0 z-50 flex w-[19rem] max-w-[86vw] flex-col border-r border-border',
          'data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <DialogTitle className="font-display text-sm font-semibold tracking-tight">{title}</DialogTitle>
          <DialogClose
            aria-label="Close navigation"
            className="rounded-control p-1.5 text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </DialogClose>
        </div>
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
});
