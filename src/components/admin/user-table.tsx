'use client';

import { Loader2, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminAction } from '@/components/admin/use-admin-action';
import { formatRelativeTime } from '@/lib/format';

export interface AdminAccountRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
  commentCount: number;
  sessionCount: number;
  lastLoginAt: string | null;
}

/**
 * Accounts, with the operator's controls.
 *
 * Deleting an account keeps its comments — they render as "Deleted account" — so a
 * thread stays readable instead of developing holes, and no video's comment counter
 * goes out of step.
 */
export function UserTable({ users }: { users: AdminAccountRow[] }) {
  const { run, busy, error, note } = useAdminAction();

  if (users.length === 0) {
    return <p className="text-sm text-foreground-subtle">No accounts yet — the next signup becomes the admin.</p>;
  }

  return (
    <div className="space-y-3">
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-2xs uppercase tracking-wider text-foreground-subtle">
              <th className="pb-2 font-semibold">Account</th>
              <th className="pb-2 font-semibold">Role</th>
              <th className="pb-2 font-semibold">Comments</th>
              <th className="pb-2 font-semibold">Sessions</th>
              <th className="pb-2 font-semibold">Joined</th>
              <th className="pb-2 font-semibold">Last login</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="py-2.5 pr-3">
                  <span className="font-medium">{user.displayName}</span>
                  <span className="block text-2xs text-foreground-subtle">{user.email}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <Badge tone={user.role === 'admin' ? 'primary' : 'neutral'}>{user.role}</Badge>
                </td>
                <td className="py-2.5 pr-3 tabular-nums">{user.commentCount}</td>
                <td className="py-2.5 pr-3 tabular-nums">{user.sessionCount}</td>
                <td className="py-2.5 pr-3 text-xs text-foreground-muted" suppressHydrationWarning>
                  {formatRelativeTime(user.createdAt)}
                </td>
                <td className="py-2.5 pr-3 text-xs text-foreground-muted" suppressHydrationWarning>
                  {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'never'}
                </td>
                <td className="py-2.5">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      pill
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`u-${user.id}`, '/api/admin/users', {
                          id: user.id,
                          action: user.role === 'admin' ? 'demote' : 'promote',
                        })
                      }
                    >
                      {user.role === 'admin' ? <ShieldOff aria-hidden /> : <ShieldCheck aria-hidden />}
                      {user.role === 'admin' ? 'Demote' : 'Make admin'}
                    </Button>
                    <Button
                      variant="danger"
                      size="icon-sm"
                      aria-label={`Delete ${user.displayName}`}
                      disabled={busy !== null}
                      onClick={() => void run(`ud-${user.id}`, '/api/admin/users', { id: user.id, action: 'delete' }, 'Account removed.')}
                    >
                      {busy === `ud-${user.id}` ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
