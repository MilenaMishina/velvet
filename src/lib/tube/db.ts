import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { TubeEmbedType, TubeSort, TubeStatus, TubeVideo } from './models';

/**
 * Tube database.
 *
 * Zero-dependency SQLite via Node's built-in `node:sqlite` — no native addon
 * build step, works on any host that runs this app. The file lives in `data/`
 * (git-ignored) and survives restarts, so scraped videos are persistent state.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'tube.db');

let dbInstance: DatabaseSync | null = null;

/**
 * Additive migrations for columns introduced after a database already existed.
 * `ALTER TABLE ... ADD COLUMN` is not idempotent, so each one is attempted and a
 * "duplicate column" error is expected and ignored on every start after the first.
 * The table-level `CREATE TABLE IF NOT EXISTS` block below is the migration for
 * everything else.
 */
const COLUMN_MIGRATIONS = [
  'ALTER TABLE sources ADD COLUMN aspect_ratio REAL',
  'ALTER TABLE videos ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0',
  // NULL = not pinned. A timestamp rather than a flag so the home page can keep
  // pins in the order they were made instead of an arbitrary one.
  'ALTER TABLE videos ADD COLUMN pinned_at TEXT',
];

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  for (const migration of COLUMN_MIGRATIONS) {
    try {
      db.exec(migration);
    } catch {
      /* Already applied. */
    }
  }
  dbInstance = db;
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  embed_url TEXT,
  embed_type TEXT NOT NULL DEFAULT 'link',
  page_url TEXT NOT NULL UNIQUE,
  duration_seconds INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT,
  scraped_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published'
);
CREATE INDEX IF NOT EXISTS idx_videos_source ON videos(source_id, scraped_at);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status, scraped_at);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  aspect_ratio REAL
);

-- Accounts. Self-hosted on purpose: the whole catalogue already lives in a local
-- SQLite file, so there is no third party to introduce for a login form.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL
);

-- Sessions are rows, not signed tokens, so a logout or a password change really
-- ends every session instead of waiting for a cookie to expire.
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id, created_at);

-- One row per viewer per video per day. The views column on the video is the
-- running total; this table is what stops a reload counting twice.
CREATE TABLE IF NOT EXISTS video_views (
  video_id TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (video_id, viewer_key, day)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  added INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  per_source TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** 16:9 — what a tube card falls back to when a source hasn't declared its shape. */
export const DEFAULT_ASPECT_RATIO = 16 / 9;

/** Every read joins the source so a card gets its poster shape without a second query. */
const VIDEO_SELECT = `SELECT v.*, COALESCE(s.name, v.source_id) AS source_name,
              COALESCE(s.aspect_ratio, ${DEFAULT_ASPECT_RATIO}) AS aspect_ratio
       FROM videos v LEFT JOIN sources s ON s.id = v.source_id`;

export interface ListVideosParams {
  q?: string;
  sourceId?: string;
  tag?: string;
  sort?: TubeSort;
  status?: TubeStatus;
  page?: number;
  perPage?: number;
  /**
   * Drop pinned rows. The home page sets this: it shows pins in their own shelf, and
   * repeating them in the feed directly below would put the same card on the screen
   * twice.
   */
  excludePinned?: boolean;
}

function rowToVideo(row: Record<string, unknown>, sourceName: string): TubeVideo {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(row.tags ?? '[]')) as unknown;
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    /* Malformed tags are cosmetic only. */
  }
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    sourceName,
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    thumbnailUrl: row.thumbnail_url == null ? null : String(row.thumbnail_url),
    embedUrl: row.embed_url == null ? null : String(row.embed_url),
    embedType: (String(row.embed_type) as TubeEmbedType) || 'link',
    pageUrl: String(row.page_url),
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    tags,
    publishedAt: row.published_at == null ? null : String(row.published_at),
    scrapedAt: String(row.scraped_at),
    views: Number(row.views ?? 0),
    aspectRatio: Number(row.aspect_ratio) > 0 ? Number(row.aspect_ratio) : DEFAULT_ASPECT_RATIO,
    commentCount: Number(row.comment_count ?? 0),
    pinned: row.pinned_at != null,
    status: (String(row.status) as TubeStatus) || 'published',
  };
}

export function listVideos(params: ListVideosParams = {}): { items: TubeVideo[]; total: number; page: number; perPage: number; hasMore: boolean } {
  const db = getDb();
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const perPage = Math.min(60, Math.max(1, Math.floor(params.perPage ?? 24)));

  const where: string[] = [];
  const args: unknown[] = [];
  where.push("status = 'published'");
  // Operator switch: hide rows we could only link to. Off by default, because a
  // card that says "open the original" is honest and still worth browsing.
  if (getSetting('hide_link_only') === '1') where.push('embed_url IS NOT NULL');
  if (params.excludePinned) where.push('pinned_at IS NULL');
  if (params.q) {
    where.push('(title LIKE ? OR tags LIKE ?)');
    const like = `%${params.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    args.push(like, like);
  }
  if (params.sourceId) {
    where.push('source_id = ?');
    args.push(params.sourceId);
  }
  if (params.tag) {
    where.push("tags LIKE ?");
    args.push(`%"${params.tag.replace(/"/g, '')}"%`);
  }

  const whereSql = where.join(' AND ');
  // Newest first means newest *published*, not newest scraped: a backfill inserts a
  // decade of back catalogue in one burst, and ordering that by `scraped_at` would
  // file the whole archive ahead of what actually came out this week. Sources that
  // don't publish a date fall back to when we found them.
  const orderSql =
    params.sort === 'views' ? 'views DESC, COALESCE(published_at, scraped_at) DESC'
    : params.sort === 'oldest' ? 'COALESCE(published_at, scraped_at) ASC'
    : 'COALESCE(published_at, scraped_at) DESC, id DESC';

  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM videos WHERE ${whereSql}`).get(...args) as { n: number } | undefined;
  const total = Number(totalRow?.n ?? 0);

  const rows = db
    .prepare(`${VIDEO_SELECT} WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
    .all(...args, perPage, (page - 1) * perPage) as Record<string, unknown>[];

  return {
    items: rows.map((row) => rowToVideo(row, String(row.source_name ?? row.source_id))),
    total,
    page,
    perPage,
    hasMore: page * perPage < total,
  };
}

export function getVideoById(id: string): TubeVideo | null {
  const row = getDb().prepare(`${VIDEO_SELECT} WHERE v.id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToVideo(row, String(row.source_name ?? row.source_id));
}

export function getRelatedVideos(video: TubeVideo, limit = 12): TubeVideo[] {
  const db = getDb();
  const rows = db
    .prepare(
      `${VIDEO_SELECT}
       WHERE v.id != ? AND v.status = 'published'
         AND (v.source_id = ? OR (v.tags LIKE ? AND v.tags != '[]'))
       ORDER BY v.views DESC, COALESCE(v.published_at, v.scraped_at) DESC LIMIT ?`,
    )
    .all(video.id, video.sourceId, `%"${(video.tags[0] ?? '').replace(/"/g, '')}"%`, limit) as Record<string, unknown>[];
  return rows.map((row) => rowToVideo(row, String(row.source_name ?? row.source_id)));
}

/** 'missing' | 'no-embed' | 'ok' — used by the sync orchestrator to decide retries. */
export function getVideoEmbedState(pageUrl: string): 'missing' | 'no-embed' | 'ok' {
  const row = getDb()
    .prepare('SELECT embed_url FROM videos WHERE page_url = ?')
    .get(pageUrl) as { embed_url: string | null } | undefined;
  if (!row) return 'missing';
  return row.embed_url ? 'ok' : 'no-embed';
}

export interface UpsertVideoInput {
  id: string;
  sourceId: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  embedType: TubeEmbedType;
  pageUrl: string;
  durationSeconds?: number | null;
  tags?: string[];
  publishedAt?: string | null;
}

const now = () => new Date().toISOString();

/** Insert a new video, or refresh an existing row without clobbering edits/views. */
export function upsertVideo(input: UpsertVideoInput): { added: boolean } {
  const db = getDb();
  const existing = db.prepare('SELECT id, embed_url, embed_type FROM videos WHERE id = ?').get(input.id) as
    | { id: string; embed_url: string | null; embed_type: string }
    | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO videos
       (id, source_id, title, description, thumbnail_url, embed_url, embed_type, page_url,
        duration_seconds, tags, published_at, scraped_at, updated_at, views, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'published')`,
    ).run(
      input.id,
      input.sourceId,
      input.title,
      input.description ?? null,
      input.thumbnailUrl ?? null,
      input.embedUrl ?? null,
      input.embedType,
      input.pageUrl,
      input.durationSeconds ?? null,
      JSON.stringify(input.tags ?? []),
      input.publishedAt ?? null,
      now(),
      now(),
    );
    return { added: true };
  }

  // Refresh embeddability for rows that previously had no playable embed.
  if (!existing.embed_url && input.embedUrl) {
    db.prepare('UPDATE videos SET embed_url = ?, embed_type = ?, updated_at = ? WHERE id = ?').run(
      input.embedUrl,
      input.embedType,
      now(),
      input.id,
    );
  } else if (existing.embed_type === 'link' && input.embedType !== 'link' && input.embedUrl) {
    db.prepare('UPDATE videos SET embed_url = ?, embed_type = ?, updated_at = ? WHERE id = ?').run(
      input.embedUrl,
      input.embedType,
      now(),
      input.id,
    );
  }
  return { added: false };
}

/**
 * Edit a video by hand.
 *
 * `pageUrl` and `sourceId` are editable too — that is what makes this a real
 * editing surface rather than a cosmetic one: a wrong link or a video filed under
 * the wrong site can be corrected without touching the database.
 */
export function updateVideo(
  id: string,
  patch: Partial<
    Pick<
      TubeVideo,
      'title' | 'thumbnailUrl' | 'embedUrl' | 'embedType' | 'tags' | 'status' | 'description' | 'pageUrl' | 'sourceId'
    >
  >,
): boolean {
  const db = getDb();
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.title !== undefined) { sets.push('title = ?'); args.push(patch.title); }
  if (patch.description !== undefined) { sets.push('description = ?'); args.push(patch.description); }
  if (patch.thumbnailUrl !== undefined) { sets.push('thumbnail_url = ?'); args.push(patch.thumbnailUrl); }
  if (patch.embedUrl !== undefined) { sets.push('embed_url = ?'); args.push(patch.embedUrl); }
  if (patch.embedType !== undefined) { sets.push('embed_type = ?'); args.push(patch.embedType); }
  if (patch.tags !== undefined) { sets.push('tags = ?'); args.push(JSON.stringify(patch.tags)); }
  if (patch.status !== undefined) { sets.push('status = ?'); args.push(patch.status); }
  if (patch.pageUrl !== undefined) { sets.push('page_url = ?'); args.push(patch.pageUrl); }
  if (patch.sourceId !== undefined) { sets.push('source_id = ?'); args.push(patch.sourceId); }
  if (sets.length === 0) return false;
  sets.push('updated_at = ?');
  args.push(now(), id);
  try {
    const result = db.prepare(`UPDATE videos SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    return Number(result.changes) > 0;
  } catch {
    // The only constraint here is the UNIQUE page_url — a duplicate link.
    return false;
  }
}

export interface ManualVideoInput {
  sourceId: string;
  title: string;
  pageUrl: string;
  description?: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  embedType?: TubeEmbedType;
  durationSeconds?: number | null;
  tags?: string[];
  publishedAt?: string | null;
}

/**
 * Insert a video by hand, for a source we don't crawl or a link that never got
 * picked up. The id is derived from the page URL, exactly as the sync derives it,
 * so a hand-added row and a later automatic scrape of the same URL collide on the
 * primary key instead of becoming two copies.
 */
export function createVideo(input: ManualVideoInput): { ok: true; id: string } | { ok: false; error: string } {
  const pageUrl = input.pageUrl.trim();
  const title = input.title.trim();
  if (!pageUrl) return { ok: false, error: 'A page URL is required.' };
  if (!title) return { ok: false, error: 'A title is required.' };

  const embedUrl = input.embedUrl?.trim() || null;
  const embedType: TubeEmbedType = input.embedType ?? (embedUrl ? 'video' : 'link');
  const id = createHash('sha1').update(pageUrl).digest('hex').slice(0, 16);
  const db = getDb();

  const clash = db.prepare('SELECT id FROM videos WHERE page_url = ?').get(pageUrl) as { id: string } | undefined;
  if (clash) return { ok: false, error: 'That page URL is already indexed.' };

  try {
    db.prepare(
      `INSERT INTO videos
       (id, source_id, title, description, thumbnail_url, embed_url, embed_type, page_url,
        duration_seconds, tags, published_at, scraped_at, updated_at, views, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'published')`,
    ).run(
      id,
      input.sourceId,
      title,
      input.description?.trim() || null,
      input.thumbnailUrl?.trim() || null,
      embedUrl,
      embedType,
      pageUrl,
      input.durationSeconds ?? null,
      JSON.stringify(input.tags ?? []),
      input.publishedAt?.trim() || null,
      now(),
      now(),
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the video.' };
  }
  return { ok: true, id };
}

/**
 * Create a source row that no adapter crawls.
 *
 * This is how an operator gets "their own section": a named bucket in the rail that
 * they fill with hand-added videos. It is never scraped, because the sync only
 * walks adapters, so a manual source costs no requests and can't be overwritten.
 */
export function createSource(input: { id: string; name: string; baseUrl?: string; aspectRatio?: number }):
  | { ok: true }
  | { ok: false; error: string } {
  const id = input.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const name = input.name.trim();
  if (!id) return { ok: false, error: 'Give the section an id (letters, numbers, dashes).' };
  if (!name) return { ok: false, error: 'Give the section a name.' };

  const db = getDb();
  const exists = db.prepare('SELECT id FROM sources WHERE id = ?').get(id);
  if (exists) return { ok: false, error: `A section called "${id}" already exists.` };

  db.prepare('INSERT INTO sources (id, name, base_url, enabled, aspect_ratio) VALUES (?, ?, ?, 0, ?)').run(
    id,
    name,
    input.baseUrl?.trim() || 'manual',
    input.aspectRatio ?? null,
  );
  return { ok: true };
}

export function deleteVideo(id: string): boolean {
  const result = getDb().prepare('DELETE FROM videos WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}

export function incrementVideoViews(id: string): void {
  getDb().prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(id);
}

/**
 * Every registered source with its published-video count.
 *
 * Unlike `topSources` this keeps sources that currently have nothing indexed, so
 * the browse rail can still show (and explain the emptiness of) a site we follow
 * but can't reach — a 0-count entry is information, not a bug.
 */
export function listSourcesWithCounts(): { id: string; name: string; count: number }[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id AS id, s.name AS name, COUNT(v.id) AS count
       FROM sources s
       LEFT JOIN videos v ON v.source_id = s.id AND v.status = 'published'
       GROUP BY s.id, s.name
       ORDER BY count DESC, s.name ASC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({ id: String(r.id), name: String(r.name), count: Number(r.count) }));
}

/**
 * Operator-pinned videos, oldest pin first.
 *
 * Ordered by when they were pinned, not by date, so the shelf stays where the
 * operator put it — pinning something should not shuffle the shelf around.
 */
export function listPinnedVideos(limit = 8): TubeVideo[] {
  const rows = getDb()
    .prepare(`${VIDEO_SELECT} WHERE v.pinned_at IS NOT NULL AND v.status = 'published' ORDER BY v.pinned_at ASC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];
  return rows.map((row) => rowToVideo(row, String(row.source_name ?? row.source_id)));
}

export function countPinnedVideos(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM videos WHERE pinned_at IS NOT NULL').get() as
    | { n: number }
    | undefined;
  return Number(row?.n ?? 0);
}

/** Pin or unpin a video. Pinning keeps its original pin time when already pinned. */
export function setVideoPinned(id: string, pinned: boolean): boolean {
  const result = getDb()
    .prepare('UPDATE videos SET pinned_at = ?, updated_at = ? WHERE id = ?')
    .run(pinned ? now() : null, now(), id);
  return Number(result.changes) > 0;
}

export function topSources(limit = 8): { id: string; name: string; count: number }[] {
  const rows = getDb()
    .prepare(
      `SELECT v.source_id AS id, COALESCE(s.name, v.source_id) AS name, COUNT(*) AS count
       FROM videos v LEFT JOIN sources s ON s.id = v.source_id
       WHERE v.status = 'published' GROUP BY v.source_id ORDER BY count DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({ id: String(r.id), name: String(r.name), count: Number(r.count) }));
}

export function topTags(limit = 14): string[] {
  const rows = getDb()
    .prepare(`SELECT tags FROM videos WHERE status = 'published' AND tags != '[]' ORDER BY scraped_at DESC LIMIT 400`)
    .all() as Record<string, unknown>[];
  const counts = new Map<string, number>();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(String(row.tags)) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const tag of parsed) {
        if (typeof tag !== 'string' || tag.length < 2) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    } catch {
      /* Skip malformed rows. */
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

/**
 * Register a source, refreshing its label on every sync.
 *
 * The upsert matters: display names live in the adapters, so renaming a source
 * there ("Desihub" → "Desi Hub") has to reach rows that were created by an
 * earlier run. `enabled` is deliberately left alone so a manual toggle survives.
 */
export function ensureSource(id: string, name: string, baseUrl: string, aspectRatio?: number): void {
  getDb()
    .prepare(
      `INSERT INTO sources (id, name, base_url, enabled, aspect_ratio) VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         base_url = excluded.base_url,
         aspect_ratio = COALESCE(excluded.aspect_ratio, sources.aspect_ratio)`,
    )
    .run(id, name, baseUrl, aspectRatio ?? null);
}

export function markSourceSynced(id: string): void {
  getDb().prepare('UPDATE sources SET last_synced_at = ? WHERE id = ?').run(now(), id);
}

export function listSources(): { id: string; name: string; baseUrl: string; enabled: boolean; lastSyncedAt: string | null }[] {
  const rows = getDb().prepare('SELECT * FROM sources ORDER BY name').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    baseUrl: String(r.base_url),
    enabled: Number(r.enabled) === 1,
    lastSyncedAt: r.last_synced_at == null ? null : String(r.last_synced_at),
  }));
}

/** Full source roster for the admin table: registry state plus what it produced. */
export interface AdminSourceRow {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  lastSyncedAt: string | null;
  total: number;
  playable: number;
}

export function adminSourceRows(): AdminSourceRow[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.name, s.base_url, s.enabled, s.last_synced_at,
              COUNT(v.id) AS total,
              SUM(CASE WHEN v.embed_url IS NOT NULL THEN 1 ELSE 0 END) AS playable
       FROM sources s LEFT JOIN videos v ON v.source_id = s.id
       GROUP BY s.id ORDER BY total DESC, s.name ASC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    baseUrl: String(r.base_url),
    enabled: Number(r.enabled) === 1,
    lastSyncedAt: r.last_synced_at == null ? null : String(r.last_synced_at),
    total: Number(r.total ?? 0),
    playable: Number(r.playable ?? 0),
  }));
}

export function setSourceEnabled(id: string, enabled: boolean): void {
  getDb().prepare('UPDATE sources SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

/**
 * Whether a source may be contacted. An unknown id counts as enabled: the flag is
 * an opt-out for parked sources, not a gate on first discovery.
 */
export function isSourceEnabled(id: string): boolean {
  const row = getDb().prepare('SELECT enabled FROM sources WHERE id = ?').get(id) as
    | { enabled: number }
    | undefined;
  return row ? Number(row.enabled) === 1 : true;
}

// ── Sync runs ────────────────────────────────────────────────────────────────

export function startSyncRun(trigger: 'manual' | 'cron'): number {
  const result = getDb()
    .prepare("INSERT INTO sync_runs (started_at, trigger, status) VALUES (?, ?, 'running')")
    .run(now(), trigger);
  return Number(result.lastInsertRowid);
}

export function finishSyncRun(id: number, summary: Omit<import('./models').SyncRunSummary, 'id' | 'startedAt' | 'finishedAt' | 'trigger'>): void {
  getDb()
    .prepare(
      `UPDATE sync_runs SET finished_at = ?, status = ?, added = ?, updated = ?, errors = ?, per_source = ? WHERE id = ?`,
    )
    .run(now(), summary.status, summary.added, summary.updated, summary.errors, JSON.stringify(summary.perSource), id);
}

export function recentSyncRuns(limit = 10): import('./models').SyncRunSummary[] {
  const rows = getDb().prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map((r) => {
    let perSource: Record<string, { added: number; updated: number; errors: number }> = {};
    try {
      perSource = JSON.parse(String(r.per_source ?? '{}')) as Record<string, { added: number; updated: number; errors: number }>;
    } catch {
      /* Cosmetic only. */
    }
    return {
      id: Number(r.id),
      startedAt: String(r.started_at),
      finishedAt: r.finished_at == null ? null : String(r.finished_at),
      trigger: (String(r.trigger) as 'manual' | 'cron') || 'manual',
      status: (String(r.status) as 'running' | 'success' | 'error') || 'running',
      added: Number(r.added ?? 0),
      updated: Number(r.updated ?? 0),
      errors: Number(r.errors ?? 0),
      perSource,
    };
  });
}

// ── Accounts, sessions, comments, views ──────────────────────────────────────

export interface TubeUser {
  id: string;
  email: string;
  displayName: string;
  role: 'member' | 'admin';
  createdAt: string;
}

function rowToUser(row: Record<string, unknown>): TubeUser {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    role: String(row.role) === 'admin' ? 'admin' : 'member',
    createdAt: String(row.created_at),
  };
}

export function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function getUserById(id: string): TubeUser | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

/** Includes the stored hash — only the auth layer should call this. */
export function getUserCredentials(email: string): { user: TubeUser; passwordHash: string } | null {
  const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return { user: rowToUser(row), passwordHash: String(row.password_hash) };
}

export function createUser(input: {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role?: 'member' | 'admin';
}): TubeUser {
  const createdAt = now();
  getDb()
    .prepare('INSERT INTO users (id, email, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(input.id, input.email.toLowerCase(), input.displayName, input.passwordHash, input.role ?? 'member', createdAt);
  return { id: input.id, email: input.email.toLowerCase(), displayName: input.displayName, role: input.role ?? 'member', createdAt };
}

export function listUsers(limit = 50): TubeUser[] {
  const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map(rowToUser);
}

export function createSession(token: string, userId: string, ttlDays: number): void {
  const created = new Date();
  const expires = new Date(created.getTime() + ttlDays * 86_400_000);
  getDb()
    .prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, created.toISOString(), expires.toISOString());
}

/** Resolve a session token, ignoring (and clearing) anything expired. */
export function getSessionUser(token: string): TubeUser | null {
  const row = getDb().prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    deleteSession(token);
    return null;
  }
  return getUserById(String(row.user_id));
}

export function deleteSession(token: string): void {
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function deleteUserSessions(userId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export interface TubeComment {
  id: string;
  videoId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

function rowToComment(row: Record<string, unknown>): TubeComment {
  return {
    id: String(row.id),
    videoId: String(row.video_id),
    userId: String(row.user_id),
    authorName: String(row.display_name ?? 'Deleted account'),
    body: String(row.body),
    createdAt: String(row.created_at),
  };
}

export function listComments(videoId: string, limit = 100): TubeComment[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, u.display_name FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.video_id = ? AND c.status = 'visible'
       ORDER BY c.created_at DESC LIMIT ?`,
    )
    .all(videoId, limit) as Record<string, unknown>[];
  return rows.map(rowToComment);
}

/** Author of a comment, or null if it doesn't exist. Used for ownership checks. */
export function getCommentOwner(id: string): string | null {
  const row = getDb().prepare('SELECT user_id FROM comments WHERE id = ?').get(id) as { user_id: string } | undefined;
  return row ? String(row.user_id) : null;
}

export function countComments(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM comments WHERE status = 'visible'").get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function addComment(input: { id: string; videoId: string; userId: string; body: string }): TubeComment {
  const db = getDb();
  const createdAt = now();
  db.prepare('INSERT INTO comments (id, video_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').run(
    input.id,
    input.videoId,
    input.userId,
    input.body,
    createdAt,
  );
  db.prepare('UPDATE videos SET comment_count = comment_count + 1 WHERE id = ?').run(input.videoId);
  const author = getUserById(input.userId);
  return {
    id: input.id,
    videoId: input.videoId,
    userId: input.userId,
    authorName: author?.displayName ?? 'Someone',
    body: input.body,
    createdAt,
  };
}

/**
 * Delete a comment and decrement the video's counter.
 *
 * Both statements run inside one transaction so a failure can't leave the count
 * permanently out of step with the rows.
 */
export function deleteComment(id: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT video_id FROM comments WHERE id = ?').get(id) as { video_id: string } | undefined;
  if (!row) return false;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    db.prepare('UPDATE videos SET comment_count = MAX(0, comment_count - 1) WHERE id = ?').run(row.video_id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return true;
}

export interface AdminCommentRow extends TubeComment {
  videoTitle: string;
}

export function adminRecentComments(limit = 40): AdminCommentRow[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, u.display_name, COALESCE(v.title, '(removed)') AS video_title
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN videos v ON v.id = c.video_id
       ORDER BY c.created_at DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({ ...rowToComment(row), videoTitle: String(row.video_title) }));
}

/**
 * Count a view at most once per viewer per video per day.
 *
 * `videos.views` stays the running total that the feed sorts on; `video_views` is
 * what stops a reload — or a refresh loop — from inflating it.
 */
export function recordView(videoId: string, viewerKey: string): { counted: boolean; views: number } {
  const db = getDb();
  const day = new Date().toISOString().slice(0, 10);
  const result = db
    .prepare('INSERT OR IGNORE INTO video_views (video_id, viewer_key, day, created_at) VALUES (?, ?, ?, ?)')
    .run(videoId, viewerKey, day, now());
  const counted = Number(result.changes) > 0;
  if (counted) db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(videoId);
  const row = db.prepare('SELECT views FROM videos WHERE id = ?').get(videoId) as { views: number } | undefined;
  return { counted, views: Number(row?.views ?? 0) };
}

// ── Duplicate detection ─────────────────────────────────────────────────────

export interface DuplicateMember {
  id: string;
  title: string;
  sourceId: string;
  sourceName: string;
  embedType: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number;
  commentCount: number;
}

export interface DuplicateGroup {
  key: string;
  /** `same-file` is near-certain (identical player/file); `same-title` is a lead. */
  reason: 'same-file' | 'same-title';
  members: DuplicateMember[];
  keepId: string;
}

/** Higher is better. Used to decide which copy survives a purge. */
function qualityScore(member: DuplicateMember): number {
  // Playability first, then a poster, then a real date, then the one with history.
  return (
    (member.embedType === 'video' ? 4 : member.embedType === 'iframe' ? 3 : 0) +
    (member.thumbnailUrl ? 2 : 0) +
    (member.publishedAt ? 1 : 0) +
    Math.min(1, member.views / 100) +
    Math.min(1, member.commentCount / 10)
  );
}

function bestOf(members: DuplicateMember[]): string {
  return [...members].sort((a, b) => qualityScore(b) - qualityScore(a) || a.id.localeCompare(b.id))[0]!.id;
}

function membersFor(where: string, value: string): DuplicateMember[] {
  const rows = getDb()
    .prepare(
      `${VIDEO_SELECT}
       WHERE ${where} AND v.status = 'published'
       ORDER BY COALESCE(v.published_at, v.scraped_at) ASC`,
    )
    .all(value) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    sourceId: String(row.source_id),
    sourceName: String(row.source_name ?? row.source_id),
    embedType: String(row.embed_type),
    thumbnailUrl: row.thumbnail_url == null ? null : String(row.thumbnail_url),
    publishedAt: row.published_at == null ? null : String(row.published_at),
    views: Number(row.views ?? 0),
    commentCount: Number(row.comment_count ?? 0),
  }));
}

/**
 * Find the same video indexed more than once.
 *
 * Two signals, strongest first: an identical embed URL means two rows point at the
 * exact same file, which is a duplicate with no judgement call. An identical
 * normalised title is a lead rather than a verdict — the same video republished
 * under a slightly different name is exactly what we want to catch, and the scan
 * shows you both so you can decide.
 */
export function findDuplicateGroups(limit = 60): DuplicateGroup[] {
  const db = getDb();
  const groups: DuplicateGroup[] = [];
  // The two signals are independent views of the same rows, so a finding is only
  // skipped when it is the *same set of rows* as one already reported — never
  // because one of its rows happened to appear in an earlier group. Suppressing
  // on membership alone hides real duplicates (a title group whose strongest
  // member was already caught by an identical-file match would vanish).
  const reported = new Set<string>();
  const setKey = (ids: string[]) => [...ids].sort().join('|');

  const fileKeys = db
    .prepare(
      `SELECT embed_url AS k FROM videos
       WHERE embed_url IS NOT NULL AND status = 'published'
       GROUP BY embed_url HAVING COUNT(*) > 1 LIMIT ?`,
    )
    .all(limit) as { k: string }[];

  for (const { k } of fileKeys) {
    const members = membersFor('v.embed_url = ?', k);
    if (members.length < 2) continue;
    reported.add(setKey(members.map((m) => m.id)));
    groups.push({ key: k, reason: 'same-file', members, keepId: bestOf(members) });
  }

  const titleKeys = db
    .prepare(
      `SELECT LOWER(TRIM(title)) AS k FROM videos
       WHERE TRIM(COALESCE(title, '')) <> '' AND status = 'published'
       GROUP BY LOWER(TRIM(title)) HAVING COUNT(*) > 1 LIMIT ?`,
    )
    .all(limit) as { k: string }[];

  for (const { k } of titleKeys) {
    const members = membersFor('LOWER(TRIM(v.title)) = ?', k);
    if (members.length < 2) continue;
    if (reported.has(setKey(members.map((m) => m.id)))) continue;
    groups.push({ key: k, reason: 'same-title', members, keepId: bestOf(members) });
  }

  return groups;
}

/**
 * Delete every duplicate except the best copy of each group.
 *
 * Comments on the copies that are removed are moved to the survivor first — the
 * whole point of de-duplicating is to consolidate a video, not to silently throw
 * away what people wrote about it.
 */
export function purgeDuplicates(): { groups: number; removed: number } {
  const db = getDb();
  const groups = findDuplicateGroups();
  const deleted = new Set<string>();
  let removed = 0;

  for (const group of groups) {
    for (const member of group.members) {
      if (member.id === group.keepId || deleted.has(member.id)) continue;
      db.exec('BEGIN');
      try {
        db.prepare('UPDATE comments SET video_id = ? WHERE video_id = ?').run(group.keepId, member.id);
        db.prepare('UPDATE videos SET comment_count = comment_count + ? WHERE id = ?').run(member.commentCount, group.keepId);
        db.prepare('DELETE FROM video_views WHERE video_id = ?').run(member.id);
        db.prepare('DELETE FROM videos WHERE id = ?').run(member.id);
        db.exec('COMMIT');
        deleted.add(member.id);
        removed += 1;
      } catch {
        db.exec('ROLLBACK');
      }
    }
  }
  return { groups: groups.length, removed };
}

// ── Accounts (operator view) ────────────────────────────────────────────────

export interface AdminUserRow extends TubeUser {
  commentCount: number;
  sessionCount: number;
  lastLoginAt: string | null;
}

export function adminUserRows(limit = 100): AdminUserRow[] {
  const rows = getDb()
    .prepare(
      `SELECT u.*,
              (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comment_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS session_count,
              (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login
       FROM users u ORDER BY u.created_at DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    ...rowToUser(row),
    commentCount: Number(row.comment_count ?? 0),
    sessionCount: Number(row.session_count ?? 0),
    lastLoginAt: row.last_login == null ? null : String(row.last_login),
  }));
}

/**
 * Remove an account and end its sessions.
 *
 * Comments are deliberately left behind: they render as "Deleted account", which
 * keeps a thread readable instead of punching holes in it. Deleting the rows would
 * also desync every affected video's comment counter.
 */
export function deleteUser(id: string): boolean {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}

export function setUserRole(id: string, role: 'member' | 'admin'): boolean {
  const result = getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  return Number(result.changes) > 0;
}

// ── Visits (user monitoring) ─────────────────────────────────────────────────

export function recordVisit(visitorId: string, path: string): void {
  getDb().prepare('INSERT INTO visits (visitor_id, path, created_at) VALUES (?, ?, ?)').run(visitorId, path, now());
}

export interface VisitorStats {
  uniqueVisitors24h: number;
  uniqueVisitors7d: number;
  pageViews24h: number;
  pageViews7d: number;
  recentVisitors: { visitorId: string; path: string; createdAt: string }[];
}

export function visitorStats(): VisitorStats {
  const db = getDb();
  const count = (sql: string, ...args: unknown[]): number => {
    const row = db.prepare(sql).get(...args) as { n: number } | undefined;
    return Number(row?.n ?? 0);
  };
  const recentRows = db
    .prepare('SELECT visitor_id, path, created_at FROM visits ORDER BY id DESC LIMIT 25')
    .all() as Record<string, unknown>[];
  return {
    uniqueVisitors24h: count("SELECT COUNT(DISTINCT visitor_id) AS n FROM visits WHERE created_at >= datetime('now', '-1 day')"),
    uniqueVisitors7d: count("SELECT COUNT(DISTINCT visitor_id) AS n FROM visits WHERE created_at >= datetime('now', '-7 days')"),
    pageViews24h: count("SELECT COUNT(*) AS n FROM visits WHERE created_at >= datetime('now', '-1 day')"),
    pageViews7d: count("SELECT COUNT(*) AS n FROM visits WHERE created_at >= datetime('now', '-7 days')"),
    recentVisitors: recentRows.map((r) => ({
      visitorId: String(r.visitor_id),
      path: String(r.path),
      createdAt: String(r.created_at),
    })),
  };
}

// ── Settings (ads, runtime options) ─────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? String(row.value) : null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

export function getSettings(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = getSetting(key);
    if (value != null) out[key] = value;
  }
  return out;
}

/** Everything the admin dashboard headlines, in one round of queries. */
export function adminStats(): {
  totalVideos: number;
  publishedVideos: number;
  hiddenVideos: number;
  playableVideos: number;
  added24h: number;
  totalViews: number;
  comments: number;
  users: number;
  sources: number;
  enabledSources: number;
} {
  const db = getDb();
  const count = (sql: string): number => {
    const row = db.prepare(sql).get() as { n: number } | undefined;
    return Number(row?.n ?? 0);
  };
  return {
    totalVideos: count('SELECT COUNT(*) AS n FROM videos'),
    publishedVideos: count("SELECT COUNT(*) AS n FROM videos WHERE status = 'published'"),
    hiddenVideos: count("SELECT COUNT(*) AS n FROM videos WHERE status = 'hidden'"),
    playableVideos: count('SELECT COUNT(*) AS n FROM videos WHERE embed_url IS NOT NULL'),
    added24h: count("SELECT COUNT(*) AS n FROM videos WHERE scraped_at >= datetime('now', '-1 day')"),
    totalViews: count('SELECT COALESCE(SUM(views), 0) AS n FROM videos'),
    comments: count("SELECT COUNT(*) AS n FROM comments WHERE status = 'visible'"),
    users: count('SELECT COUNT(*) AS n FROM users'),
    sources: count('SELECT COUNT(*) AS n FROM sources'),
    enabledSources: count('SELECT COUNT(*) AS n FROM sources WHERE enabled = 1'),
  };
}

/**
 * Moderation list: pinned rows first, then newest, including hidden ones.
 *
 * Pins float to the top so the operator can see (and unpin) what is currently on
 * the front page without paging through the whole catalogue to find it.
 */
export function adminRecentVideos(limit = 40): TubeVideo[] {
  const rows = getDb()
    .prepare(
      `${VIDEO_SELECT}
       ORDER BY (v.pinned_at IS NOT NULL) DESC, COALESCE(v.published_at, v.scraped_at) DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map((row) => rowToVideo(row, String(row.source_name ?? row.source_id)));
}

export function tubeStats(): { totalVideos: number; publishedVideos: number; added24h: number; totalViews: number; sources: number } {
  const db = getDb();
  const count = (sql: string): number => {
    const row = db.prepare(sql).get() as { n: number } | undefined;
    return Number(row?.n ?? 0);
  };
  return {
    totalVideos: count('SELECT COUNT(*) AS n FROM videos'),
    publishedVideos: count("SELECT COUNT(*) AS n FROM videos WHERE status = 'published'"),
    added24h: count("SELECT COUNT(*) AS n FROM videos WHERE scraped_at >= datetime('now', '-1 day')"),
    totalViews: count('SELECT COALESCE(SUM(views), 0) AS n FROM videos'),
    sources: count('SELECT COUNT(*) AS n FROM sources WHERE enabled = 1'),
  };
}
