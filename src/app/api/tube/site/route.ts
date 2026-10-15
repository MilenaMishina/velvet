import { NextResponse } from 'next/server';

import { getSetting } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tube/site — public site-wide state the chrome needs.
 *
 * Right now that is the operator's notice banner. It lives on an endpoint rather
 * than in the root layout because reading the database there would opt every page
 * in the app into dynamic rendering, for a banner that is usually empty.
 */
export async function GET() {
  const notice = (getSetting('site_notice') ?? '').trim();
  return NextResponse.json(
    { data: { notice } },
    // Short cache: a notice should appear within a minute of being saved.
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } },
  );
}
