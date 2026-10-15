import { NextResponse } from 'next/server';

import { listSourcesWithCounts } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tube/sources — the sites we index, with counts.
 *
 * The nav rail is client-rendered chrome that sits in the root layout, so it can't
 * read SQLite on the server without forcing every page in the app to render
 * dynamically. Fetching the list here keeps the layout static and the rail current.
 */
export async function GET() {
  return NextResponse.json(
    { data: { sources: listSourcesWithCounts() } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
