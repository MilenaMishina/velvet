'use client';

import { Compass, Globe2, Home, Menu, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Dialog, DrawerContent } from '@/components/ui/dialog';
import { useTubeSources } from '@/lib/hooks/use-tube-sources';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const PRIMARY = [
  { label: 'Home', href: routes.home, Icon: Home },
  { label: 'Trending', href: routes.trending, Icon: TrendingUp },
  { label: 'All', href: routes.tube.index, Icon: Globe2 },
] as const;

/** Exact match for `/`, prefix match for everything else. */
function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Mobile navigation: a thumb-reachable bottom bar plus a swipe-in drawer listing
 * every indexed source. Hidden from `lg` up, where the sidebar takes over.
 */
export function MobileNav() {
  const pathname = usePathname();
  const sources = useTubeSources();
  const [open, setOpen] = React.useState(false);

  // Route changes should never leave the drawer hanging open.
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <nav
        aria-label="Primary"
        className="nav-surface fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid h-16 grid-cols-4">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-full flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors',
                    active ? 'text-primary' : 'text-foreground-muted',
                  )}
                >
                  <item.Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Browse sources"
              className="flex h-full w-full flex-col items-center justify-center gap-1 text-2xs font-medium text-foreground-muted"
            >
              <Menu className="size-5" aria-hidden />
              Browse
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DrawerContent title="Browse">
          <div className="flex-1 overflow-y-auto px-2 py-3">
            <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
              Categories
            </p>
            <ul className="space-y-0.5">
              {sources.map((source) => (
                <li key={source.id}>
                  <Link
                    href={routes.tube.filtered({ source: source.id })}
                    className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                  >
                    <Globe2 className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{source.name}</span>
                    {source.count > 0 ? (
                      <span className="ml-auto text-2xs tabular-nums text-foreground-subtle">{source.count}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
              {sources.length === 0 ? (
                <li className="flex items-center gap-3 px-3 py-2.5 text-sm text-foreground-subtle">
                  <Compass className="size-4" aria-hidden />
                  No sources indexed yet
                </li>
              ) : null}
            </ul>
          </div>
        </DrawerContent>
      </Dialog>
    </>
  );
}
