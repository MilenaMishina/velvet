import { KeyRound } from 'lucide-react';

/**
 * Shown instead of a feed when `YOUTUBE_API_KEY` is missing.
 *
 * Without a key there is nothing to render and no point pretending otherwise —
 * so the first run explains exactly what to do rather than showing empty shelves.
 */
export function SetupNotice() {
  return (
    <div className="panel mx-auto max-w-2xl rounded-card px-6 py-12 shadow-card sm:px-10">
      <span className="brand-gradient grid size-11 place-items-center rounded-control shadow-glow">
        <KeyRound className="size-5 text-primary-foreground" aria-hidden />
      </span>

      <h1 className="mt-5 font-display text-2xl font-bold tracking-[-0.02em]">Add a YouTube API key to begin</h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        This YouTube surface reads everything from the official YouTube Data API v3. It needs your own key — the key
        stays on the server and is never sent to the browser.
      </p>

      <ol className="mt-6 space-y-3 text-sm text-foreground-muted">
        <li className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-raised text-2xs font-semibold text-foreground">
            1
          </span>
          <span>
            In the{' '}
            <a
              href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2"
            >
              Google Cloud console
            </a>
            , enable <strong className="font-semibold text-foreground">YouTube Data API v3</strong>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-raised text-2xs font-semibold text-foreground">
            2
          </span>
          <span>
            Create an <strong className="font-semibold text-foreground">API key</strong> under Credentials, and restrict
            it to that API.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-raised text-2xs font-semibold text-foreground">
            3
          </span>
          <span>
            Copy <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs">.env.example</code> to{' '}
            <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs">.env.local</code>, set{' '}
            <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs">YOUTUBE_API_KEY</code>, then restart the
            dev server.
          </span>
        </li>
      </ol>

      <p className="mt-6 text-xs leading-relaxed text-foreground-subtle">
        The free tier grants 10,000 quota units per day, and this surface is built to stay well inside that: a feed
        refresh costs 1 unit, search costs 100, and everything is cached — see the README for the full breakdown.
      </p>
    </div>
  );
}
