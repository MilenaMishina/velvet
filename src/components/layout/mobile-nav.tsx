'use client';

import { Compass, Globe2, Home, LayoutGrid, Menu, Tags, TrendingUp } from 'lucide-react';
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
  { label: 'Tags', href: routes.tags, Icon: Tags },
] as const;

/** Exact match for `/`, prefix match for everything else. */
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === routes.trending) return pathname === routes.trending;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Mobile navigation: a thumb-reachable app bar plus a drawer listing every
 * indexed source.
 *
 * Five targets, each a full-height tap area with a heat indicator on the active
 * tab. Safe-area padding keeps the bar off the iPhone home indicator.
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
        className="nav-surface fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid h-[4.25rem] grid-cols-5">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-full flex-col items-center justify-center gap-1 text-[0.6rem] font-bold uppercase tracking-[0.08em] transition-colors',
                    active ? 'text-foreground' : 'text-foreground-subtle',
                  )}
                >
                  {active ? (
                    <span aria-hidden className="heat-gradient absolute inset-x-4 top-0 h-0.5 rounded-full" />
                  ) : null}
                  <item.Icon
                    className={cn('size-[1.35rem] transition-colors', active ? 'text-primary' : 'text-foreground-subtle')}
                    strokeWidth={active ? 2.4 : 1.8}
                    aria-hidden
                  />
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
              className="flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-foreground-subtle"
            >
              <Menu className="size-[1.35rem]" strokeWidth={1.8} aria-hidden />
              Browse
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DrawerContent title="Browse">
          <div className="flex-1 overflow-y-auto px-2 py-3">
            <p className="px-3 pb-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-foreground-subtle">
              Sites we index
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

            <p className="mt-4 px-3 pb-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-foreground-subtle">
              Discover
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href={routes.tags}
                  className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                >
                  <Tags className="size-4 shrink-0" aria-hidden />
                  All tags
                </Link>
              </li>
              <li>
                <Link
                  href={routes.sources}
                  className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                >
                  <LayoutGrid className="size-4 shrink-0" aria-hidden />
                  Source directory
                </Link>
              </li>
              <li>
                <Link
                  href={routes.random}
                  prefetch={false}
                  className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface-raised"
                >
                  🎲 Surprise me
                </Link>
              </li>
            </ul>
          </div>
        </DrawerContent>
      </Dialog>
    </>
  );
}
