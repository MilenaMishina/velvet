'use client';

import {
  Activity,
  BarChart3,
  Database,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { DuplicateFinder } from '@/components/admin/duplicate-finder';
import { UserTable, type AdminAccountRow } from '@/components/admin/user-table';
import { VideoEditor, type EditableVideo } from '@/components/admin/video-editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ADSTERRA_UNITS,
  AD_PLACEMENTS,
  AD_SETTING_KEYS,
  type AdSettingKey,
} from '@/lib/ads';
import { formatCompactNumber, formatExactNumber, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const ASPECT_PRESETS: Array<{ label: string; value: string }> = [
  { label: '16:9 landscape', value: '1.7778' },
  { label: '4:3 landscape', value: '1.3333' },
  { label: '3:4 portrait', value: '0.75' },
  { label: '2:3 portrait', value: '0.6667' },
];

export interface AdminStats {
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
}

export interface AdminSource {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  lastSyncedAt: string | null;
  total: number;
  playable: number;
}

export interface AdminRun {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  trigger: string;
  status: string;
  added: number;
  updated: number;
  errors: number;
  perSource: Record<string, { added: number; updated: number; errors: number }>;
}

export interface AdminVideo extends EditableVideo {
  sourceName: string;
  views: number;
  commentCount: number;
  scrapedAt: string;
}

/** Home page shelves this many pins, oldest pin first. */
const PIN_LIMIT = 8;

export interface AdminComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  videoTitle: string;
}


export interface AdminVisitors {
  uniqueVisitors24h: number;
  uniqueVisitors7d: number;
  pageViews24h: number;
  pageViews7d: number;
}

export interface AdminSettingsValues {
  auto_sync_minutes: string;
  hide_link_only: string;
  site_notice: string;
  /** Ad switches, keyed by setting name. Empty means "unset", which is "on". */
  ads: Record<AdSettingKey, string>;
}

export interface AdminDashboardProps {
  stats: AdminStats;
  sources: AdminSource[];
  runs: AdminRun[];
  videos: AdminVideo[];
  comments: AdminComment[];
  users: AdminAccountRow[];
  visitors: AdminVisitors;
  settings: AdminSettingsValues;
  /** Set when accounts could not be read, so the panel never implies "no accounts". */
  accountsError?: string;
}

/** Small helper so every mutation shares one request/refresh/error path. */
function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const run = React.useCallback(
    async (key: string, url: string, body: unknown, successNote?: string) => {
      setBusy(key);
      setError(null);
      setNote(null);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string; data?: unknown };
        if (!response.ok) {
          setError(payload.error ?? `Request failed (${response.status}).`);
          return null;
        }
        if (successNote) setNote(successNote);
        router.refresh();
        return payload.data ?? null;
      } catch {
        setError('Could not reach the server.');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [router],
  );

  return { run, busy, error, note };
}

export function AdminDashboard(props: AdminDashboardProps) {
  const { stats, sources, runs, videos, comments, users, visitors, settings, accountsError } = props;
  const { run, busy, error, note } = useAdminAction();
  const router = useRouter();

  const [pages, setPages] = React.useState('2');
  const [maxFetches, setMaxFetches] = React.useState('30');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [showLinkOnly, setShowLinkOnly] = React.useState(settings.hide_link_only !== '1');

  const [autoSync, setAutoSync] = React.useState(settings.auto_sync_minutes || '120');
  const [notice, setNotice] = React.useState(settings.site_notice || '');
  // An unset switch is an on switch, which is what the server-side default does too.
  const [ads, setAds] = React.useState<Record<AdSettingKey, boolean>>(
    () => Object.fromEntries(AD_SETTING_KEYS.map((key) => [key, settings.ads[key] !== '0'])) as Record<AdSettingKey, boolean>,
  );

  const toggleAd = (key: AdSettingKey) => {
    const next = !ads[key];
    setAds((current) => ({ ...current, [key]: next }));
    void run(`ad-${key}`, '/api/admin/settings', { key, value: next ? '1' : '0' }, `${next ? 'Enabled' : 'Disabled'} ${key.replace('ads_', '')}.`);
  };

  const [lastRun, setLastRun] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<EditableVideo | 'new' | null>(null);
  const [newSection, setNewSection] = React.useState({ id: '', name: '', aspectRatio: '1.7778' });
  const pinnedCount = videos.filter((video) => video.pinned).length;

  const startSync = async (deep: boolean) => {
    const data = (await run(
      deep ? 'backfill' : 'sync',
      '/api/admin/sync',
      {
        pages: Number(deep ? pages : 2),
        maxFetches: Number(deep ? maxFetches : 30),
        ...(selected.length > 0 ? { sources: selected } : {}),
      },
    )) as { added?: number; updated?: number; errors?: number } | null;
    if (data) {
      setLastRun(`added ${data.added ?? 0} · updated ${data.updated ?? 0} · errors ${data.errors ?? 0}`);
    }
  };

  /** Re-read the source pages of videos we could only link to, one batch at a time. */
  const repairPlayers = async () => {
    const data = (await run('repair', '/api/admin/repair', { limit: 25 })) as {
      attempted?: number;
      resolved?: number;
      remaining?: number;
    } | null;
    if (data) {
      setLastRun(
        `players repaired ${data.resolved ?? 0}/${data.attempted ?? 0} · ${data.remaining ?? 0} still link-only`,
      );
    }
  };

  const signOutAdmin = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Operator</p>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] sm:text-3xl">Admin dashboard</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Sources, scheduling, settings and moderation run on the local database; accounts
            live in Supabase.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" pill onClick={() => router.refresh()}>
            <RefreshCw aria-hidden />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" pill onClick={() => void signOutAdmin()}>
            Lock
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/12 px-4 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="rounded-control bg-success/12 px-4 py-2.5 text-sm font-medium text-success">
          {note}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Videos" value={stats.totalVideos} hint={`${stats.publishedVideos} published · ${stats.hiddenVideos} hidden`} Icon={Database} />
        <Stat label="Playable" value={stats.playableVideos} hint={`${Math.round((stats.playableVideos / Math.max(1, stats.totalVideos)) * 100)}% of the catalogue`} Icon={Zap} />
        <Stat label="Added (24h)" value={stats.added24h} hint="new rows from the sync" Icon={Activity} />
        <Stat label="Total views" value={stats.totalViews} hint="deduped per viewer per day" Icon={BarChart3} />
        <Stat label="Comments" value={stats.comments} hint="visible" Icon={MessageSquare} />
        <Stat label="Accounts" value={stats.users} hint="the first one is admin" Icon={Users} />
        <Stat label="Sources" value={stats.sources} hint={`${stats.enabledSources} enabled`} Icon={Globe2} />
        <Stat label="Visitors 24h" value={visitors.uniqueVisitors24h} hint={`${visitors.pageViews24h} page views`} Icon={Eye} />
      </section>

      <Section title="Sync" description="A routine run walks a couple of listing pages per source. A backfill walks deep.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <NumberField id="pages" label="Listing pages / source" value={pages} onChange={setPages} min={1} max={400} />
              <NumberField id="fetches" label="Post fetches / source" value={maxFetches} onChange={setMaxFetches} min={1} max={2000} />
              <Button variant="primary" size="md" pill disabled={busy !== null} onClick={() => void startSync(false)}>
                {busy === 'sync' ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                Sync now
              </Button>
              <Button variant="outline" size="md" pill disabled={busy !== null} onClick={() => void startSync(true)}>
                {busy === 'backfill' ? <Loader2 className="animate-spin" aria-hidden /> : <Zap aria-hidden />}
                Deep backfill
              </Button>
              <Button variant="outline" size="md" pill disabled={busy !== null} onClick={() => void repairPlayers()}>
                {busy === 'repair' ? <Loader2 className="animate-spin" aria-hidden /> : <Wrench aria-hidden />}
                Repair players
              </Button>
            </div>

            <div>
              <p className="pb-1.5 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
                Limit to sources (none selected = every enabled source)
              </p>
              <ul className="flex flex-wrap gap-2">
                {sources.map((source) => {
                  const on = selected.includes(source.id);
                  return (
                    <li key={source.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setSelected((current) =>
                            current.includes(source.id) ? current.filter((id) => id !== source.id) : [...current, source.id],
                          )
                        }
                        className={cn(
                          'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
                          on ? 'brand-gradient text-primary-foreground' : 'panel text-foreground-muted hover:text-foreground',
                        )}
                      >
                        {source.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="text-xs text-foreground-subtle">
              A backfill of 60 pages × 900 fetches is roughly 1200 videos and takes minutes; it is safe to re-run, because
              videos are de-duplicated by their page URL. <strong className="text-foreground">Repair players</strong> re-reads
              the source page of videos we could only link to (25 per press) and stores any player it finds, so a row the sync
              could not play still ends up playable.{' '}
              {stats.totalVideos > stats.playableVideos ? (
                <span>{stats.totalVideos - stats.playableVideos} rows are link-only right now.</span>
              ) : null}{' '}
              {lastRun ? <strong className="text-foreground">Last run: {lastRun}.</strong> : null}
            </p>
          </div>
        </div>

        <RunsTable runs={runs} />
      </Section>

      <Section title="Sources" description="Disabling a source stops all requests to it; everything already indexed stays browsable.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-2xs uppercase tracking-wider text-foreground-subtle">
                <th className="pb-2 font-semibold">Source</th>
                <th className="pb-2 font-semibold">Indexed</th>
                <th className="pb-2 font-semibold">Playable</th>
                <th className="pb-2 font-semibold">Last synced</th>
                <th className="pb-2 font-semibold">State</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-t border-border">
                  <td className="py-2.5 pr-3">
                    <span className="font-medium">{source.name}</span>
                    <span className="block truncate text-2xs text-foreground-subtle">{source.baseUrl}</span>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">{formatExactNumber(source.total)}</td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {formatExactNumber(source.playable)}
                    <span className="ml-1.5 text-2xs text-foreground-subtle">
                      {source.total > 0 ? `${Math.round((source.playable / source.total) * 100)}%` : ''}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-muted" suppressHydrationWarning>
                    {source.lastSyncedAt ? formatRelativeTime(source.lastSyncedAt) : 'never'}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={source.enabled ? 'primary' : 'neutral'}>{source.enabled ? 'Enabled' : 'Parked'}</Badge>
                  </td>
                  <td className="py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        pill
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`src-sync-${source.id}`, '/api/admin/sync', {
                            pages: Number(pages),
                            maxFetches: Number(maxFetches),
                            sources: [source.id],
                          })
                        }
                      >
                        {busy === `src-sync-${source.id}` ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                        Sync
                      </Button>
                      <Button
                        variant={source.enabled ? 'ghost' : 'primary'}
                        size="sm"
                        pill
                        disabled={busy !== null}
                        onClick={() => void run(`src-${source.id}`, '/api/admin/sources', { id: source.id, enabled: !source.enabled })}
                      >
                        {source.enabled ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                        {source.enabled ? 'Park' : 'Resume'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Settings" description="Runtime options stored in the database — no redeploy needed.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="auto-sync" className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
              Auto-sync interval (minutes, 0 disables)
            </label>
            <div className="flex gap-2">
              <input
                id="auto-sync"
                type="number"
                min={0}
                value={autoSync}
                onChange={(event) => setAutoSync(event.target.value)}
                className="panel h-10 w-full rounded-control px-3 text-sm outline-none focus:shadow-glow"
              />
              <Button
                variant="outline"
                size="md"
                pill
                disabled={busy !== null}
                onClick={() => void run('set-autosync', '/api/admin/settings', { key: 'auto_sync_minutes', value: Number(autoSync) })}
              >
                {busy === 'set-autosync' ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                Save
              </Button>
            </div>
            <p className="text-2xs text-foreground-subtle">Applies from the next tick; the cron endpoint always works.</p>
          </div>

          <div className="space-y-1.5">
            <span className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Feed</span>
            <button
              type="button"
              role="switch"
              aria-checked={!showLinkOnly}
              onClick={() => {
                const next = !showLinkOnly;
                setShowLinkOnly(next);
                void run('set-linkonly', '/api/admin/settings', { key: 'hide_link_only', value: next ? '0' : '1' });
              }}
              className="panel flex w-full items-center justify-between gap-3 rounded-control px-3 py-2.5 text-left text-sm"
            >
              <span>
                Show link-only rows
                <span className="block text-2xs text-foreground-subtle">
                  Videos whose source exposed no player. Hiding them leaves the feed strictly playable.
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-pill transition-colors',
                  showLinkOnly ? 'bg-primary' : 'bg-surface-raised',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-5 rounded-full bg-background transition-transform',
                    showLinkOnly ? 'translate-x-[1.4rem]' : 'translate-x-0.5',
                  )}
                />
              </span>
            </button>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="site-notice" className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
              Site notice (empty hides the banner)
            </label>
            <div className="flex gap-2">
              <input
                id="site-notice"
                value={notice}
                maxLength={200}
                onChange={(event) => setNotice(event.target.value)}
                placeholder="e.g. Source maintenance tonight"
                className="panel h-10 w-full rounded-control px-3 text-sm outline-none focus:shadow-glow"
              />
              <Button
                variant="outline"
                size="md"
                pill
                disabled={busy !== null}
                onClick={() => void run('set-notice', '/api/admin/settings', { key: 'site_notice', value: notice })}
              >
                {busy === 'set-notice' ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                Save
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Ads"
        description="One network: Adsterra everywhere — banners, native cards, the in-video overlay, and the popunder and social bar. Changes apply to the next page render."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Ads on the site"
            description="Master switch: every unit, tag and script."
            on={ads.ads_enabled}
            disabled={busy !== null}
            onChange={() => toggleAd('ads_enabled')}
          />
          <Toggle
            label="In-feed native"
            description="Sponsored cards in the feed."
            on={ads.ads_native}
            disabled={busy !== null}
            onChange={() => toggleAd('ads_native')}
          />
          <Toggle
            label="In-video overlay"
            description="The unit pinned over the player on a watch page."
            on={ads.ads_invideo}
            disabled={busy !== null}
            onChange={() => toggleAd('ads_invideo')}
          />
          <Toggle
            label="Popunder and social bar"
            description="Adsterra's page-level scripts."
            on={ads.ads_page_scripts}
            disabled={busy !== null}
            onChange={() => toggleAd('ads_page_scripts')}
          />
        </div>

        <details className="panel rounded-card p-3">
          <summary className="cursor-pointer text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
            Unit map — every ad and where it lives
          </summary>
          <p className="pt-2 text-xs text-foreground-muted">
            Every slot renders one Adsterra unit, sized to the space the slot occupies, never larger.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
              <thead>
                <tr className="text-2xs uppercase tracking-wider text-foreground-subtle">
                  <th className="pb-2 font-semibold">Slots</th>
                  <th className="pb-2 font-semibold">Size</th>
                  <th className="pb-2 font-semibold">Network</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {Object.entries(AD_PLACEMENTS).map(([name, slot]) => (
                  <tr key={name} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">{name}</td>
                    <td className="py-2 pr-3 tabular-nums text-foreground-subtle">{ADSTERRA_UNITS[slot.unit].label}</td>
                    <td className="py-2 pr-3 text-foreground-subtle">Adsterra</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pt-3 text-2xs text-foreground-subtle">
            Page-level units outside this map: the popunder, the social bar and the native feed — all Adsterra.
          </p>
        </details>
      </Section>

      <Section
        title="Content"
        description="Add a video or a section by hand, edit anything the sync got wrong, pin what belongs on the front page, hide or delete a row."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="md"
            pill
            onClick={() => setEditing('new')}
            aria-expanded={editing === 'new'}
          >
            <Plus aria-hidden />
            Add a video
          </Button>
          <p className="text-xs text-foreground-muted">
            <Pin className="mr-1 inline size-3.5 text-primary" aria-hidden />
            <strong className="text-foreground">{pinnedCount}</strong> pinned — the home page carries the first{' '}
            {PIN_LIMIT}, oldest pin first. Pinned rows sit at the top of this table.
          </p>
        </div>

        {editing ? <VideoEditor sources={sources} editing={editing} onClose={() => setEditing(null)} /> : null}

        <details className="panel rounded-card p-3">
          <summary className="cursor-pointer text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
            Create your own section
          </summary>
          <p className="pt-2 text-xs text-foreground-muted">
            A section with no crawler: it exists so you can file your own videos under it. Nothing is ever requested
            from it, so it can never be overwritten by a sync.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <input
              aria-label="Section id"
              placeholder="id (e.g. my-collection)"
              value={newSection.id}
              onChange={(event) => setNewSection((s) => ({ ...s, id: event.target.value }))}
              className="panel h-10 rounded-control px-3 text-sm outline-none focus:shadow-glow"
            />
            <input
              aria-label="Section name"
              placeholder="Display name"
              value={newSection.name}
              onChange={(event) => setNewSection((s) => ({ ...s, name: event.target.value }))}
              className="panel h-10 rounded-control px-3 text-sm outline-none focus:shadow-glow"
            />
            <select
              aria-label="Poster shape"
              value={newSection.aspectRatio}
              onChange={(event) => setNewSection((s) => ({ ...s, aspectRatio: event.target.value }))}
              className="panel h-10 rounded-control px-3 text-sm outline-none focus:shadow-glow"
            >
              {ASPECT_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="md"
              pill
              disabled={busy !== null || !newSection.id.trim() || !newSection.name.trim()}
              onClick={async () => {
                const created = await run('new-section', '/api/admin/sources', {
                  action: 'create',
                  id: newSection.id,
                  name: newSection.name,
                  aspectRatio: Number(newSection.aspectRatio),
                }, 'Section created.');
                if (created !== null) setNewSection({ id: '', name: '', aspectRatio: '1.7778' });
              }}
            >
              {busy === 'new-section' ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              Create
            </Button>
          </div>
        </details>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-2xs uppercase tracking-wider text-foreground-subtle">
                <th className="pb-2 font-semibold">Video</th>
                <th className="pb-2 font-semibold">Source</th>
                <th className="pb-2 font-semibold">Views</th>
                <th className="pb-2 font-semibold">Comments</th>
                <th className="pb-2 font-semibold">State</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id} className="border-t border-border">
                  <td className="max-w-[22rem] py-2.5 pr-3">
                    {video.pinned ? <Badge tone="accent">Pinned</Badge> : null}
                    <span className="line-clamp-1 font-medium">{video.title || '(untitled)'}</span>
                    <span className="block text-2xs text-foreground-subtle">{video.embedType}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-muted">{video.sourceName}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{formatCompactNumber(video.views)}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{video.commentCount}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={video.status === 'published' ? 'primary' : 'warning'}>{video.status}</Badge>
                  </td>
                  <td className="py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={video.pinned ? 'primary' : 'ghost'}
                        size="sm"
                        pill
                        disabled={busy !== null}
                        aria-pressed={video.pinned}
                        title={video.pinned ? 'Remove from the home page' : 'Keep on the home page'}
                        onClick={() =>
                          void run(`pin-${video.id}`, '/api/admin/videos', {
                            id: video.id,
                            action: video.pinned ? 'unpin' : 'pin',
                          })
                        }
                      >
                        {video.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
                        {video.pinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        pill
                        onClick={() => setEditing(video)}
                        aria-expanded={editing !== null && editing !== 'new' && editing.id === video.id}
                      >
                        <Pencil aria-hidden />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        pill
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`vid-${video.id}`, '/api/admin/videos', {
                            id: video.id,
                            action: video.status === 'published' ? 'hide' : 'publish',
                          })
                        }
                      >
                        {video.status === 'published' ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                        {video.status === 'published' ? 'Hide' : 'Publish'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        pill
                        disabled={busy !== null}
                        onClick={() => void run(`del-${video.id}`, '/api/admin/videos', { id: video.id, action: 'delete' }, 'Video deleted.')}
                      >
                        <Trash2 aria-hidden />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="pt-6 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Recent comments</h3>
        <p className="pt-1 text-xs text-foreground-muted">
          Deleting a comment here also decrements the video&rsquo;s counter, in the same transaction.
        </p>
        {comments.length === 0 ? (
          <p className="pt-2 text-sm text-foreground-subtle">No comments yet.</p>
        ) : (
          <ul className="space-y-2 pt-2">
            {comments.map((comment) => (
              <li key={comment.id} className="panel flex items-start gap-3 rounded-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground-subtle">
                    <strong className="font-semibold text-foreground">{comment.authorName}</strong> on{' '}
                    <span className="line-clamp-1">{comment.videoTitle}</span> ·{' '}
                    <span suppressHydrationWarning>{formatRelativeTime(comment.createdAt)}</span>
                  </p>
                  <p className="mt-1 break-words text-sm text-foreground-muted">{comment.body}</p>
                </div>
                <Button
                  variant="danger"
                  size="icon-sm"
                  disabled={busy !== null}
                  aria-label="Delete comment"
                  onClick={() => void run(`cm-${comment.id}`, `/api/tube/comments/${comment.id}`, {}, 'Comment deleted.')}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Duplicate finder" description="The same video indexed more than once, from a re-scrape or across two sites.">
        <DuplicateFinder />
      </Section>

      <Section title="Accounts" description="Every account, with what it has done and the operator's controls.">
        {accountsError ? (
          <p role="alert" className="mb-3 rounded-control bg-danger/12 px-3 py-2 text-xs font-medium text-danger">
            Accounts could not be read: {accountsError} This table may be incomplete.
          </p>
        ) : null}
        <UserTable users={users} />
      </Section>

      <Section title="Traffic" description="Anonymous visit counting — no third-party analytics.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Visitors 24h" value={visitors.uniqueVisitors24h} Icon={Users} />
          <Stat label="Visitors 7d" value={visitors.uniqueVisitors7d} Icon={Users} />
          <Stat label="Page views 24h" value={visitors.pageViews24h} Icon={Eye} />
          <Stat label="Page views 7d" value={visitors.pageViews7d} Icon={Eye} />
        </div>
      </Section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  Icon,
}: {
  label: string;
  value: number;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="panel rounded-card p-3.5">
      <div className="flex items-center gap-2 text-foreground-subtle">
        <Icon className="size-3.5" aria-hidden />
        <span className="text-2xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums tracking-[-0.02em]">
        {formatCompactNumber(value)}
      </p>
      {hint ? <p className="mt-0.5 text-2xs text-foreground-subtle">{hint}</p> : null}
    </div>
  );
}

/** One ad switch. A switch rather than a checkbox so its state survives a glance. */
function Toggle({
  label,
  description,
  on,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  on: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className="panel flex w-full items-start justify-between gap-3 rounded-control px-3 py-2.5 text-left text-sm transition-colors hover:border-border-strong disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {description ? <span className="block text-2xs leading-relaxed text-foreground-subtle">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-pill transition-colors',
          on ? 'bg-primary' : 'bg-surface-raised',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-background transition-transform',
            on ? 'translate-x-[1.4rem]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel space-y-4 rounded-card p-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-foreground-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="panel h-10 w-40 rounded-control px-3 text-sm tabular-nums outline-none focus:shadow-glow"
      />
    </div>
  );
}

function RunsTable({ runs }: { runs: AdminRun[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-foreground-subtle">No sync has run yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="text-left text-2xs uppercase tracking-wider text-foreground-subtle">
            <th className="pb-2 font-semibold">Run</th>
            <th className="pb-2 font-semibold">Started</th>
            <th className="pb-2 font-semibold">Status</th>
            <th className="pb-2 font-semibold">Added</th>
            <th className="pb-2 font-semibold">Updated</th>
            <th className="pb-2 font-semibold">Errors</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-border">
              <td className="py-2 pr-3 tabular-nums text-foreground-subtle">#{run.id}</td>
              <td className="py-2 pr-3 text-xs text-foreground-muted" suppressHydrationWarning>
                {formatRelativeTime(run.startedAt)} · {run.trigger}
              </td>
              <td className="py-2 pr-3">
                <Badge tone={run.status === 'success' ? 'primary' : run.status === 'error' ? 'warning' : 'neutral'}>
                  {run.status}
                </Badge>
              </td>
              <td className="py-2 pr-3 tabular-nums">{run.added}</td>
              <td className="py-2 pr-3 tabular-nums">{run.updated}</td>
              <td className="py-2 pr-3 tabular-nums">{run.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
