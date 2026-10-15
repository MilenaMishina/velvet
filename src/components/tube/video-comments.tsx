'use client';

import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { SessionUser } from '@/lib/auth-constants';
import { formatRelativeTime } from '@/lib/format';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export interface CommentItem {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

const MAX_BODY = 1200;

/**
 * Comments for a video.
 *
 * Reading is open to everyone; posting needs an account. The list is seeded from
 * the server render so the section is populated before hydration, and posting
 * appends optimistically only after the server has accepted it.
 */
export function VideoComments({
  videoId,
  initialComments,
}: {
  videoId: string;
  initialComments: CommentItem[];
}) {
  const { user, ready } = useCurrentUser();
  const pathname = usePathname();
  const [comments, setComments] = React.useState<CommentItem[]>(initialComments);
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const remaining = MAX_BODY - value.length;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (text.length < 2 || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/tube/videos/${encodeURIComponent(videoId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const body = (await response.json().catch(() => ({}))) as { data?: { comment?: CommentItem }; error?: string };
      if (!response.ok || !body.data?.comment) {
        setError(body.error ?? 'Could not post that comment.');
        return;
      }
      setComments((current) => [body.data!.comment as CommentItem, ...current]);
      setValue('');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/tube/comments/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    if (response?.ok) setComments((current) => current.filter((comment) => comment.id !== id));
  };

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-foreground-subtle" aria-hidden />
        <h2 id="comments-heading" className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
          Comments
          <span className="ml-2 tabular-nums text-foreground-muted">{comments.length}</span>
        </h2>
      </div>

      {!ready ? (
        <div className="panel h-24 animate-pulse rounded-card" aria-hidden />
      ) : user ? (
        <form onSubmit={submit} className="panel rounded-card p-3">
          <div className="flex items-start gap-3">
            <Avatar name={user.displayName || user.email} />
            <div className="min-w-0 flex-1 space-y-2">
              <textarea
                value={value}
                onChange={(event) => setValue(event.target.value.slice(0, MAX_BODY))}
                rows={3}
                placeholder="Say something…"
                aria-label="Your comment"
                className="w-full resize-y bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-subtle"
              />
              <div className="flex items-center justify-between gap-3">
                <span className={cn('text-2xs tabular-nums', remaining < 80 ? 'text-warning' : 'text-foreground-subtle')}>
                  {remaining} left
                </span>
                <Button type="submit" variant="primary" size="sm" pill disabled={pending || value.trim().length < 2}>
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                  Post
                </Button>
              </div>
            </div>
          </div>
          {error ? (
            <p role="alert" className="mt-2 rounded-control bg-danger/12 px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-card px-4 py-3">
          <p className="text-sm text-foreground-muted">Sign in to join the conversation.</p>
          <Button asChild variant="outline" size="sm" pill>
            <Link href={`${routes.login}?next=${encodeURIComponent(pathname || '/')}`}>Sign in</Link>
          </Button>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="px-1 text-sm text-foreground-subtle">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="panel flex items-start gap-3 rounded-card p-3">
              <Avatar name={comment.authorName} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-sm font-semibold">{comment.authorName}</span>
                  <span className="text-2xs text-foreground-subtle" suppressHydrationWarning>
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                  {user && (user.id === comment.userId || user.role === 'admin') ? (
                    <button
                      type="button"
                      onClick={() => void remove(comment.id)}
                      aria-label="Delete comment"
                      className="ml-auto rounded-full p-1.5 text-foreground-subtle transition-colors hover:bg-danger/12 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-foreground-muted">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="brand-gradient grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-primary-foreground"
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** Rendered while the comments are still being fetched on the client. */
export function VideoCommentsSkeleton() {
  return <div className="panel h-40 animate-pulse rounded-card" aria-hidden />;
}

export type { SessionUser };
