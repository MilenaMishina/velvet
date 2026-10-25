import Link from 'next/link';
import { Flame } from 'lucide-react';

import { publicEnv } from '@/lib/env';
import { routes } from '@/lib/routes';
import { topTags } from '@/lib/tube/db';

const BROWSE = [
  { label: 'Home', href: routes.home },
  { label: 'All videos', href: routes.tube.index },
  { label: 'Trending', href: routes.trending },
  { label: 'Tags', href: routes.tags },
  { label: 'Sources', href: routes.sources },
  { label: 'Surprise me', href: routes.random },
];

const LEGAL = [
  { label: 'About', href: routes.legal.about },
  { label: 'Terms of service', href: routes.legal.terms },
  { label: 'Privacy policy', href: routes.legal.privacy },
  { label: 'DMCA', href: routes.legal.dmca },
  { label: '18 U.S.C. 2257', href: routes.legal['2257'] },
  { label: 'Contact', href: routes.legal.contact },
];

/**
 * Site-wide footer.
 *
 * A server component on purpose: the tag row is read straight from the catalogue,
 * so the footer is a live part of the site rather than a static legalese slab.
 * Rendered in the root layout and handed into the shell as a prop, which keeps
 * the database access on the server even though the shell itself is a client
 * component.
 */
export async function SiteFooter() {
  let tags: string[] = [];
  try {
    tags = topTags(14);
  } catch {
    // A footer must never take a page down with it.
  }

  return (
    <footer className="relative mt-16 pb-10 pt-12">
      {/* The house gradient closing the page, the same signature that tops the site. */}
      <div aria-hidden className="heat-gradient absolute inset-x-0 top-0 h-0.5 opacity-70" />
      <div className="mx-auto grid max-w-[1980px] gap-10 px-4 sm:px-6 lg:grid-cols-[1.4fr_1fr_1.2fr_1fr] lg:px-8">
        {/* Brand column. */}
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-[-0.02em]">
            <span className="heat-gradient grid size-7 place-items-center rounded-[0.6rem] shadow-glow">
              <Flame className="size-4 text-primary-foreground" aria-hidden />
            </span>
            <span className="brand-text">{publicEnv.siteName}</span>
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-foreground-muted">
            An adult video index. Every scene is discovered on the sites we follow and played from
            the publisher&rsquo;s own player — nothing is hosted, copied or re-coded here.
          </p>
          <p className="inline-flex items-center gap-2 rounded-pill border border-border px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
            <span aria-hidden className="size-2 rounded-full bg-danger" />
            Restricted to adults · RTA labelled
          </p>
        </div>

        {/* Browse column. */}
        <nav aria-label="Browse">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Browse</h2>
          <ul className="mt-4 space-y-2.5">
            {BROWSE.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={item.href === routes.random ? false : undefined}
                  className="text-sm text-foreground-muted transition-colors hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Live tag cloud — the most-searched words on the catalogue. */}
        <nav aria-label="Popular tags">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Popular tags</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={routes.tube.tag(tag)}
                  className="chip !px-3 !py-1 !text-2xs"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Legal column — the pages that make this a real site rather than a page. */}
        <nav aria-label="Legal">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Legal</h2>
          <ul className="mt-4 space-y-2.5">
            {LEGAL.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-foreground-muted transition-colors hover:text-primary">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1980px] flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 pt-6 text-xs text-foreground-subtle sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} {publicEnv.siteName}. All indexed scenes remain the property of their publishers.</p>
        <p>18+ only. By browsing you confirm you are of legal age in your jurisdiction.</p>
      </div>
    </footer>
  );
}
