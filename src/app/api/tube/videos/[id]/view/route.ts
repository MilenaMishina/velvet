import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { newVisitorId, VISITOR_COOKIE_NAME } from '@/lib/tube/admin';
import { recordView } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tube/videos/[id]/view — count one view.
 *
 * Counted at most once per viewer per video per day, where a viewer is the signed-in
 * account if there is one and the anonymous visitor cookie otherwise. Without that,
 * a reload — or a tab left on a refresh loop — would inflate the number the feed
 * sorts "Most watched" by, which is worse than having no number at all.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  const user = await getCurrentUser();
  const viewerKey = user ? `user:${user.id}` : `visitor:${existing || newVisitorId()}`;

  const result = recordView(params.id, viewerKey);

  const response = NextResponse.json(
    { data: { views: result.views, counted: result.counted } },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
  if (!existing && !user) {
    response.cookies.set(VISITOR_COOKIE_NAME, viewerKey.replace(/^visitor:/, ''), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return response;
}
