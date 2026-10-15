'use client';

import { BookmarkCheck, BookmarkPlus, Heart, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { useLibrary } from '@/components/providers/library-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ToggleableList } from '@/lib/library/storage';

interface ToggleConfig {
  label: string;
  savedLabel: string;
  Icon: LucideIcon;
  SavedIcon: LucideIcon;
}

const CONFIG: Record<ToggleableList, ToggleConfig> = {
  watchLater: {
    label: 'Save to Watch later',
    savedLabel: 'Remove from Watch later',
    Icon: BookmarkPlus,
    SavedIcon: BookmarkCheck,
  },
  favorites: {
    label: 'Add to Favorites',
    savedLabel: 'Remove from Favorites',
    Icon: Heart,
    SavedIcon: Heart,
  },
};

export interface LibraryToggleProps {
  list: ToggleableList;
  videoId: string;
  /** `overlay` floats on a thumbnail; `inline` sits in a row of page actions. */
  appearance?: 'overlay' | 'inline';
  className?: string;
}

/**
 * Toggles one saved list. State lives in localStorage (see `LibraryProvider`), so
 * this works with no account and never sends anything to a server.
 */
export function LibraryToggle({ list, videoId, appearance = 'overlay', className }: LibraryToggleProps) {
  const library = useLibrary();
  const saved = library.has(list, videoId);
  const config = CONFIG[list];
  const Icon = saved ? config.SavedIcon : config.Icon;
  const label = saved ? config.savedLabel : config.label;

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // Cards wrap the whole tile in a link — don't navigate when saving.
      event.preventDefault();
      event.stopPropagation();
      library.toggle(list, videoId);
    },
    [library, list, videoId],
  );

  if (appearance === 'inline') {
    return (
      <Button
        variant={saved ? 'subtle' : 'outline'}
        size="md"
        pill
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        className={className}
      >
        <Icon className={cn(saved && list === 'favorites' && 'fill-current text-danger')} aria-hidden />
        <span className="hidden sm:inline">{list === 'favorites' ? 'Favorite' : 'Watch later'}</span>
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-8 place-items-center rounded-full bg-black/65 text-white shadow-soft backdrop-blur-sm',
        'transition-[transform,background-color,opacity] duration-200 ease-spring hover:scale-105 hover:bg-black/80',
        'focus-visible:opacity-100',
        saved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        className,
      )}
    >
      <Icon
        className={cn('size-4', saved && list === 'favorites' && 'fill-current text-danger')}
        aria-hidden
      />
    </button>
  );
}

/** The pair of quick actions shown on a video card's thumbnail. */
export function CardLibraryActions({ videoId }: { videoId: string }) {
  return (
    <div className="absolute right-2 top-2 z-20 flex flex-col gap-1.5">
      <LibraryToggle list="watchLater" videoId={videoId} />
      <LibraryToggle list="favorites" videoId={videoId} />
    </div>
  );
}
