'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { formatAbsoluteDate, formatExactNumber } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppVideo } from '@/lib/youtube/models';

/** Turn bare URLs and #hashtags in a description into safe links. */
function renderDescription(text: string): React.ReactNode[] {
  const pattern = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]}]|#[\p{L}\p{N}_]+)/gu;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    if (token.startsWith('#')) {
      nodes.push(
        <Link
          key={`t-${key++}`}
          href={routes.search({ q: token.slice(1) })}
          className="font-medium text-primary hover:underline"
        >
          {token}
        </Link>,
      );
    } else {
      nodes.push(
        <a
          key={`u-${key++}`}
          href={token}
          target="_blank"
          // Descriptions are creator-authored: treat every link as untrusted.
          rel="noreferrer noopener nofollow"
          className="break-all font-medium text-primary hover:underline"
        >
          {token}
        </a>,
      );
    }
    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/**
 * Expandable description panel.
 *
 * Collapsed to four lines by default — YouTube descriptions routinely run to
 * hundreds of lines of links, and burying the recommendations below them is the
 * single worst part of the original layout.
 */
export function VideoDescription({ video }: { video: AppVideo }) {
  const [expanded, setExpanded] = React.useState(false);
  const description = video.description.trim();
  const collapsible = description.length > 280 || description.split('\n').length > 4;

  return (
    <section aria-label="Description" className="panel rounded-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-foreground-muted">
        {video.viewCount !== null ? <span>{formatExactNumber(video.viewCount)} views</span> : null}
        {video.publishedAt ? <span>{formatAbsoluteDate(video.publishedAt)}</span> : null}
        {video.hasCaptions ? <span>Captions available</span> : null}
      </div>

      {description ? (
        <div
          id="video-description"
          className={cn(
            'mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted',
            !expanded && collapsible && 'line-clamp-4',
          )}
        >
          {renderDescription(description)}
        </div>
      ) : (
        <p className="mt-3 text-sm text-foreground-subtle">This video has no description.</p>
      )}

      {collapsible ? (
        <Button
          variant="ghost"
          size="sm"
          pill
          className="mt-2 -ml-1.5"
          aria-expanded={expanded}
          aria-controls="video-description"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      ) : null}

      {video.tags.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {video.tags.slice(0, 10).map((tag) => (
            <li key={tag}>
              <Link
                href={routes.search({ q: tag })}
                className="inline-flex rounded-pill bg-surface-raised/70 px-2.5 py-1 text-2xs font-medium text-foreground-muted transition-colors hover:text-foreground"
              >
                #{tag.replace(/\s+/g, '')}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
