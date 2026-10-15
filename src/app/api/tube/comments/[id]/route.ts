import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser, isSameOriginRequest } from '@/lib/auth';
import { deleteComment, getCommentOwner } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/tube/comments/[id] — the author or an admin.
 *
 * Ownership is checked against the session, never against anything the caller
 * sends, so passing someone else's comment id cannot delete their comment.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request refused.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const owner = getCommentOwner(params.id);
  if (!owner) {
    return NextResponse.json({ error: 'Unknown comment.' }, { status: 404 });
  }
  if (owner !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'That comment is not yours.' }, { status: 403 });
  }

  return NextResponse.json({ ok: deleteComment(params.id) }, { headers: { 'Cache-Control': 'no-store' } });
}
