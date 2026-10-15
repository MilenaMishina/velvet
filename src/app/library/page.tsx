import { Library } from 'lucide-react';
import type { Metadata } from 'next';

import { LibraryShelf } from '@/components/library/library-shelf';
import { PageHeader } from '@/components/layout/page-header';
import { TabLinks } from '@/components/layout/tab-links';
import { LIBRARY_LISTS, type LibraryList } from '@/lib/library/storage';

export const metadata: Metadata = {
  title: 'Your library',
  description: 'Watch later, favorites and history — stored privately in your browser.',
  robots: { index: false, follow: false },
};

const LABELS: Record<LibraryList, string> = {
  watchLater: 'Watch later',
  favorites: 'Favorites',
  history: 'History',
};

function parseList(raw: string | undefined): LibraryList {
  return LIBRARY_LISTS.includes(raw as LibraryList) ? (raw as LibraryList) : 'watchLater';
}

/**
 * Library page.
 *
 * The lists themselves live in localStorage, so this page is a static shell — the
 * only thing the server does is pick the active tab from the URL. Nothing about a
 * visitor's saves is ever sent to or stored on the server.
 */
export default function LibraryPage({ searchParams }: { searchParams: { list?: string } }) {
  const list = parseList(searchParams.list);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          <>
            <Library className="size-3.5" aria-hidden />
            Private to this browser
          </>
        }
        title="Your library"
        description="Saves and history are kept in localStorage — no account, no sync, nothing stored on our side. We only ask YouTube for the details of the videos you saved."
      />

      <TabLinks
        tabs={LIBRARY_LISTS.map((item) => ({
          label: LABELS[item],
          href: `/library?list=${item}`,
          active: item === list,
        }))}
      />

      {/* `key` forces a fresh fetch when the tab changes. */}
      <LibraryShelf key={list} list={list} />
    </div>
  );
}
