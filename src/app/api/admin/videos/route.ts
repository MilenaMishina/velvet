import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth';
import { isAdminRequest } from '@/lib/tube/admin';
import { createVideo, deleteVideo, setVideoPinned, updateVideo } from '@/lib/tube/db';
import type { TubeEmbedType, TubeStatus } from '@/lib/tube/models';

export const dynamic = 'force-dynamic';

const EMBED_TYPES: TubeEmbedType[] = ['video', 'iframe', 'link'];
const STATUSES: TubeStatus[] = ['published', 'hidden'];
const MAX_TEXT = 4000;

function text(value: unknown, max = MAX_TEXT): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

function nullableText(value: unknown, max = 2000): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
}

/**
 * POST /api/admin/videos — moderate, edit or add a video.
 *
 * One endpoint because all four actions are the same authority over the same row:
 * `hide`/`publish` are the reversible moderation switch, `delete` is for take-downs,
 * `update` is the editing surface, and `create` is for a video the sync never found.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request) || !(await isAdminRequest())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const action = text(body.action, 20) ?? '';
  const id = text(body.id, 64) ?? '';

  if (action === 'create') {
    const embedUrl = nullableText(body.embedUrl);
    const requestedType = text(body.embedType, 10);
    const result = createVideo({
      sourceId: text(body.sourceId, 64) ?? '',
      title: text(body.title, 300) ?? '',
      pageUrl: text(body.pageUrl, 1000) ?? '',
      description: nullableText(body.description) ?? undefined,
      thumbnailUrl: nullableText(body.thumbnailUrl) ?? undefined,
      embedUrl: embedUrl ?? undefined,
      embedType: EMBED_TYPES.includes(requestedType as TubeEmbedType) ? (requestedType as TubeEmbedType) : undefined,
      tags: Array.isArray(body.tags) ? (body.tags.filter((t): t is string => typeof t === 'string').slice(0, 12)) : undefined,
      publishedAt: nullableText(body.publishedAt, 40) ?? undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ data: { id: result.id } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!id) return NextResponse.json({ error: 'Missing video id.' }, { status: 400 });

  if (action === 'delete') {
    return NextResponse.json({ ok: deleteVideo(id) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'hide' || action === 'publish') {
    const status: TubeStatus = action === 'hide' ? 'hidden' : 'published';
    return NextResponse.json({ ok: updateVideo(id, { status }), status }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Pinning is separate from `update` on purpose: it is a one-press editorial call
  // from a list, not a field in a form, and it must not require saving the rest of
  // the row along with it.
  if (action === 'pin' || action === 'unpin') {
    const pinned = action === 'pin';
    return NextResponse.json({ ok: setVideoPinned(id, pinned), pinned }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'update') {
    const patch: Parameters<typeof updateVideo>[1] = {};
    const title = text(body.title, 300);
    if (title !== undefined) patch.title = title;
    const pageUrl = text(body.pageUrl, 1000);
    if (pageUrl !== undefined && pageUrl.trim()) patch.pageUrl = pageUrl.trim();
    const sourceId = text(body.sourceId, 64);
    if (sourceId !== undefined && sourceId.trim()) patch.sourceId = sourceId.trim();

    const description = nullableText(body.description);
    if (description !== undefined) patch.description = description;
    const thumbnailUrl = nullableText(body.thumbnailUrl, 1000);
    if (thumbnailUrl !== undefined) patch.thumbnailUrl = thumbnailUrl;
    const embedUrl = nullableText(body.embedUrl, 1000);
    if (embedUrl !== undefined) patch.embedUrl = embedUrl;

    const embedType = text(body.embedType, 10);
    if (EMBED_TYPES.includes(embedType as TubeEmbedType)) patch.embedType = embedType as TubeEmbedType;
    const status = text(body.status, 10);
    if (STATUSES.includes(status as TubeStatus)) patch.status = status as TubeStatus;

    const tags = text(body.tags, 400);
    if (tags !== undefined) {
      patch.tags = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12);
    }

    const ok = updateVideo(id, patch);
    return NextResponse.json({ ok }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
