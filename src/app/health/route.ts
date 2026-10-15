import { NextResponse } from 'next/server';

import { tubeStats } from '@/lib/tube/db';

export const dynamic = 'force-dynamic';

/**
 * Liveness and readiness.
 *
 * `/health` is what the platform and any uptime check should poll. It reads the
 * database on purpose: a process that is up but whose SQLite file is missing or
 * unreadable is not serving this app, and answering `ok` for it would be a lie that
 * turns a loud failure into a silent one.
 */
export async function GET() {
  try {
    const stats = tubeStats();
    return NextResponse.json(
      {
        status: 'ok',
        videos: stats.publishedVideos,
        sources: stats.sources,
        uptimeSeconds: Math.round(process.uptime()),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'error', detail: error instanceof Error ? error.message : 'database unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
