'use client';

import { LayoutDashboard, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCurrentUser, signOut } from '@/lib/hooks/use-current-user';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

/** First letter of the display name, or the email if that is all we have. */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/**
 * Navbar account control.
 *
 * Three states: still resolving, signed out (a plain Sign in link) and signed in
 * (an avatar menu). The resolving state renders the same footprint as the others so
 * the nav never shifts once the answer arrives.
 */
export function AccountMenu({ className }: { className?: string }) {
  const { user, ready } = useCurrentUser();
  const pathname = usePathname();

  if (!ready) {
    return <span aria-hidden className={cn('size-9 shrink-0 rounded-full bg-surface-raised/70', className)} />;
  }

  if (!user) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        pill
        className={cn('shrink-0', className)}
      >
        <Link href={`${routes.login}?next=${encodeURIComponent(pathname || '/')}`}>
          <LogIn aria-hidden />
          <span className="hidden sm:inline">Sign in</span>
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'brand-gradient grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground shadow-glow transition-transform duration-200 ease-spring hover:scale-105 focus-visible:outline-none',
          className,
        )}
        aria-label={`Account: ${user.displayName}`}
      >
        {initial(user.displayName || user.email)}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate text-xs font-semibold normal-case tracking-normal text-foreground">
            {user.displayName}
          </span>
          <span className="block truncate text-2xs font-normal normal-case tracking-normal text-foreground-subtle">
            {user.email}
          </span>
        </DropdownMenuLabel>

        {user.role === 'admin' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={routes.admin} className="cursor-pointer">
                <ShieldCheck aria-hidden className="size-4 text-primary" />
                Admin dashboard
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="text-danger focus:bg-danger/12 data-[highlighted]:bg-danger/12">
          <LogOut aria-hidden className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Signed-out placeholder used by the navbar's Suspense fallback. */
export function AccountMenuFallback() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-raised/70">
      <LayoutDashboard className="size-4 text-foreground-subtle" aria-hidden />
    </span>
  );
}
