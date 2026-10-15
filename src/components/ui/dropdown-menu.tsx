'use client';

import * as Primitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'panel-raised z-50 min-w-[15rem] overflow-hidden rounded-card p-1.5 shadow-lifted',
          // Radix waits for the exit animation before unmounting, so a menu that
          // "fades in" on close would stay fully visible until it pops away.
          'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
});

const itemClasses =
  'relative flex cursor-pointer select-none items-center gap-2.5 rounded-control px-2.5 py-2 text-sm outline-none transition-colors focus:bg-surface-raised data-[highlighted]:bg-surface-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof Primitive.Item>,
  React.ComponentPropsWithoutRef<typeof Primitive.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return <Primitive.Item ref={ref} className={cn(itemClasses, className)} {...props} />;
});

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof Primitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof Primitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <Primitive.RadioItem ref={ref} className={cn(itemClasses, 'pr-8', className)} {...props}>
      {children}
      <Primitive.ItemIndicator className="absolute right-2.5 flex items-center">
        <Check className="size-4 text-primary" aria-hidden />
      </Primitive.ItemIndicator>
    </Primitive.RadioItem>
  );
});

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Primitive.Label>) {
  return (
    <Primitive.Label
      className={cn('px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn('my-1.5 h-px bg-border', className)} {...props} />;
}
