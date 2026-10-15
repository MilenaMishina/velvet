import type { Metadata } from 'next';

import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { AdminLogin } from '@/components/admin/admin-login';
import { isAdminRequest } from '@/lib/tube/admin';
import { adminUserRows, countUsers } from '@/lib/auth';
import {
  adminRecentComments,
  adminRecentVideos,
  adminSourceRows,
  adminStats,
  getSettings,
  recentSyncRuns,
  visitorStats,
} from '@/lib/tube/db';

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Operate the site: sources, scheduling, settings and moderation.',
  // An operator console has no business in a search index.
  robots: { index: false, follow: false },
};

/** Reads the admin cookie and live database state, so it can never be static. */
export const dynamic = 'force-dynamic';

/**
 * Operator console.
 *
 * Everything on this page is a read of local database state; every action is a POST
 * to an `/api/admin/*` route that re-checks the admin cookie server-side. Gating the
 * page alone would be a client-side illusion — the endpoints are the real boundary.
 */
export default async function AdminPage() {
  if (!(await isAdminRequest())) return <AdminLogin />;

  const settings = getSettings(['auto_sync_minutes', 'hide_link_only', 'site_notice']);

  // Accounts are read from Supabase while every count beside them is local, so the two
  // reads overlap instead of queueing.
  const [accounts, accountCount] = await Promise.all([adminUserRows(100), countUsers()]);

  return (
    <AdminDashboard
      stats={{ ...adminStats(), users: accountCount.ok ? accountCount.data : 0 }}
      sources={adminSourceRows()}
      runs={recentSyncRuns(10)}
      videos={adminRecentVideos(24).map((video) => ({
        id: video.id,
        title: video.title,
        pageUrl: video.pageUrl,
        sourceId: video.sourceId,
        sourceName: video.sourceName,
        status: video.status,
        embedType: video.embedType,
        thumbnailUrl: video.thumbnailUrl,
        embedUrl: video.embedUrl,
        tags: video.tags,
        description: video.description,
        pinned: video.pinned,
        views: video.views,
        commentCount: video.commentCount,
        scrapedAt: video.scrapedAt,
      }))}
      comments={adminRecentComments(15).map((comment) => ({
        id: comment.id,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: comment.createdAt,
        videoTitle: comment.videoTitle,
      }))}
      users={accounts.ok ? accounts.data : []}
      accountsError={accounts.ok ? undefined : accounts.error}
      visitors={visitorStats()}
      settings={{
        auto_sync_minutes: settings.auto_sync_minutes ?? '',
        hide_link_only: settings.hide_link_only ?? '0',
        site_notice: settings.site_notice ?? '',
      }}
    />
  );
}
