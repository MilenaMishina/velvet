import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface TabLink {
  label: string;
  href: string;
  active: boolean;
  count?: number | null;
}

/**
 * Tabs as links, not state.
 *
 * Keeping the active tab in the URL means each tab is server-rendered, shareable
 * and cacheable — and no tab logic ships to the browser.
 */
export function TabLinks({ tabs, className }: { tabs: TabLink[]; className?: string }) {
  return (
    <nav className={cn('flex items-center gap-1 border-b border-border', className)} aria-label="Sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'relative -mb-px px-3.5 py-3 text-sm font-medium transition-colors',
            tab.active ? 'text-foreground' : 'text-foreground-muted hover:text-foreground',
          )}
        >
          {tab.label}
          {typeof tab.count === 'number' ? (
            <span className="ml-1.5 text-2xs text-foreground-subtle">{tab.count}</span>
          ) : null}
          {tab.active ? (
            <span aria-hidden className="brand-gradient absolute inset-x-2 bottom-0 h-0.5 rounded-pill" />
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
