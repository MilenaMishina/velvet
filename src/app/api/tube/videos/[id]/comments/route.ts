import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser, isSameOriginRequest } from '@/lib/auth';
import { addComment, getVideoById, listComments } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

const MAX_BODY = 1200;

/** GET /api/tube/videos/[id]/comments — newest first. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!getVideoById(params.id)) {
    return NextResponse.json({ error: 'Unknown video.' }, { status: 404 });
  }
  return NextResponse.json(
    { data: { comments: listComments(params.id) } },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

/** POST /api/tube/videos/[id]/comments — requires an account. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Cross-origin request refused.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to comment.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!getVideoById(params.id)) {
    return NextResponse.json({ error: 'Unknown video.' }, { status: 404 });
  }

  let raw = '';
  try {
    const body = (await request.json()) as { body?: unknown };
    raw = typeof body.body === 'string' ? body.body : '';
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  // Collapse runs of blank lines so a comment can't be used to stretch the page.
  const text = raw.replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 2) {
    return NextResponse.json({ error: 'Write something first.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Comments are capped at ${MAX_BODY} characters.` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const comment = addComment({ id: randomUUID(), videoId: params.id, userId: user.id, body: text });
  return NextResponse.json({ data: { comment } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
