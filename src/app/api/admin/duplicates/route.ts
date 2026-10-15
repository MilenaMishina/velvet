import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth';
import { isAdminRequest } from '@/lib/tube/admin';
import { findDuplicateGroups, purgeDuplicates } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/** GET /api/admin/duplicates — scan only. Never writes. */
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }
  const groups = findDuplicateGroups();
  return NextResponse.json(
    {
      data: {
        groups: groups.map((group) => ({
          key: group.key,
          reason: group.reason,
          keepId: group.keepId,
          members: group.members.map((member) => ({
            id: member.id,
            title: member.title,
            sourceName: member.sourceName,
            embedType: member.embedType,
            publishedAt: member.publishedAt,
            views: member.views,
          })),
        })),
        extraCopies: groups.reduce((total, group) => total + group.members.length - 1, 0),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * POST /api/admin/duplicates — delete every copy except the best one per group.
 *
 * The scan is a separate call on purpose: this is the only irreversible bulk action
 * in the console, so the operator sees exactly what would go before it does.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const result = purgeDuplicates();
  return NextResponse.json({ data: result }, { headers: { 'Cache-Control': 'no-store' } });
}
