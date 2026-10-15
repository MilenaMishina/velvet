'use client';

import { Copy, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminAction } from '@/components/admin/use-admin-action';

interface ScanMember {
  id: string;
  title: string;
  sourceName: string;
  embedType: string;
  publishedAt: string | null;
  views: number;
}

interface ScanGroup {
  key: string;
  reason: 'same-file' | 'same-title';
  keepId: string;
  members: ScanMember[];
}

interface ScanResult {
  groups: ScanGroup[];
  extraCopies: number;
}

/**
 * Find and remove the same video indexed twice.
 *
 * Two-step on purpose. The scan only reads, and it shows precisely which row would
 * survive each group before anything is deleted — this is the only irreversible
 * bulk action in the console, so it earns a confirmation rather than a single
 * button that quietly removes a few hundred rows.
 */
export function DuplicateFinder() {
  const { run, busy, error, note } = useAdminAction();
  const [scan, setScan] = React.useState<ScanResult | null>(null);

  const doScan = async () => {
    const data = await run<ScanResult>('scan', '/api/admin/duplicates');
    if (data) setScan(data);
  };

  const doPurge = async () => {
    const data = await run<{ groups: number; removed: number }>(
      'purge',
      '/api/admin/duplicates',
      {},
      'Duplicates removed — the best copy of each was kept.',
    );
    if (data) setScan({ groups: [], extraCopies: 0 });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="md" pill disabled={busy !== null} onClick={() => void doScan()}>
          {busy === 'scan' ? <Loader2 className="animate-spin" aria-hidden /> : <Copy aria-hidden />}
          Scan for duplicates
        </Button>
        {scan && scan.extraCopies > 0 ? (
          <Button variant="danger" size="md" pill disabled={busy !== null} onClick={() => void doPurge()}>
            {busy === 'purge' ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            Keep the best &amp; delete {scan.extraCopies} {scan.extraCopies === 1 ? 'copy' : 'copies'}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/12 px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="rounded-control bg-success/12 px-3 py-2 text-xs font-medium text-success">
          {note}
        </p>
      ) : null}

      {scan === null ? (
        <p className="text-sm text-foreground-subtle">
          A scan groups videos that share an identical player URL, then ones that share an identical title. Nothing is
          deleted until you confirm.
        </p>
      ) : scan.groups.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-foreground-muted">
          <ShieldCheck className="size-4 text-success" aria-hidden />
          No duplicates found.
        </p>
      ) : (
        <>
          <p className="text-sm text-foreground-muted">
            <strong className="text-foreground">{scan.groups.length}</strong> groups ·{' '}
            <strong className="text-foreground">{scan.extraCopies}</strong> removable copies. The row marked{' '}
            <em>keep</em> is the one that survives — it plays, or has a poster, or has the history.
          </p>
          <ul className="space-y-3">
            {scan.groups.slice(0, 25).map((group) => (
              <li key={`${group.reason}:${group.key}`} className="panel rounded-card p-3">
                <div className="flex flex-wrap items-center gap-2 pb-2">
                  <Badge tone={group.reason === 'same-file' ? 'primary' : 'neutral'}>
                    {group.reason === 'same-file' ? 'Same file' : 'Same title'}
                  </Badge>
                  <span className="text-xs text-foreground-subtle">{group.members.length} copies</span>
                </div>
                <ul className="space-y-1">
                  {group.members.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className={member.id === group.keepId ? 'font-semibold text-success' : 'text-danger'}>
                        {member.id === group.keepId ? 'keep' : 'delete'}
                      </span>
                      <span className="line-clamp-1 max-w-[26rem] text-foreground-muted">{member.title}</span>
                      <span className="text-foreground-subtle">{member.sourceName}</span>
                      <span className="text-foreground-subtle">{member.embedType}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {scan.groups.length > 25 ? (
            <p className="text-xs text-foreground-subtle">Showing the first 25 of {scan.groups.length} groups.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
