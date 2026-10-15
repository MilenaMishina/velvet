'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CategoryIcon } from '@/components/icons/category-icon';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppCategory } from '@/lib/youtube/models';

/**
 * Swipeable category rail.
 *
 * Snap-scrolled and edge-faded on touch, wrapping into a normal row on wide
 * screens where the sidebar already lists everything.
 */
export function CategoryChips({ categories, className }: { categories: AppCategory[]; className?: string }) {
  const pathname = usePathname();

  return (
    <div className={cn('fade-edge-x -mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0', className)}>
      <ul className="flex w-max items-center gap-2 pb-1">
        <li>
          <Chip href={routes.home} active={pathname === '/'}>
            All
          </Chip>
        </li>
        {categories.map((category) => {
          const href = routes.category(category.slug);
          return (
            <li key={category.slug}>
              <Chip href={href} active={pathname === href}>
                <CategoryIcon icon={category.icon} className="size-3.5" />
                {category.title}
              </Chip>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 py-2 text-xs font-semibold transition-all duration-200 ease-spring',
        active
          ? 'brand-gradient text-primary-foreground shadow-glow'
          : 'panel text-foreground-muted hover:border-border-strong hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}
