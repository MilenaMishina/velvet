import Image from 'next/image';

import { cn } from '@/lib/utils';
import type { AppVideoChannelRef } from '@/lib/youtube/models';

const SIZES = { sm: 28, md: 36, lg: 48, xl: 80 } as const;

export interface ChannelAvatarProps {
  channel: Pick<AppVideoChannelRef, 'title' | 'avatarUrl'>;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Channel avatar with a deterministic initial fallback — avatars come from a
 * separate 1-unit call, so a feed can legitimately render before they arrive.
 */
export function ChannelAvatar({ channel, size = 'md', className }: ChannelAvatarProps) {
  const px = SIZES[size];
  const initial = channel.title.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised ring-1 ring-border',
        className,
      )}
      style={{ width: px, height: px }}
    >
      {channel.avatarUrl ? (
        <Image
          src={channel.avatarUrl}
          alt=""
          width={px}
          height={px}
          className="size-full object-cover"
          sizes={`${px}px`}
        />
      ) : (
        <span
          aria-hidden
          className="font-display text-xs font-semibold text-foreground-muted"
          style={{ fontSize: Math.max(11, px * 0.4) }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
