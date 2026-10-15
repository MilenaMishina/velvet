import Image from 'next/image';
import Link from 'next/link';
import { ListVideo } from 'lucide-react';

import { formatCompactNumber } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { AppPlaylist } from '@/lib/youtube/models';
import { cn } from '@/lib/utils';

/** Grid of playlist cards — thumbnail plus item count, linking to our own page. */
export function PlaylistGrid({ playlists, className }: { playlists: AppPlaylist[]; className?: string }) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-x-5 gap-y-8 xs:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5',
        className,
      )}
    >
      {playlists.map((playlist, index) => (
        <li key={playlist.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}>
          <Link href={routes.playlist(playlist.id)} className="group block">
            <div className="relative aspect-video overflow-hidden rounded-card bg-surface-sunken">
              {playlist.thumbnail ? (
                <Image
                  src={playlist.thumbnail.url}
                  alt=""
                  fill
                  sizes="(min-width: 1536px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                  className="object-cover transition-transform duration-500 ease-out-quint group-hover:scale-[1.04]"
                />
              ) : (
                <div className="grid size-full place-items-center text-foreground-subtle">
                  <ListVideo className="size-6" aria-hidden />
                </div>
              )}

              {/* Stacked-card edge so a playlist reads differently from a video. */}
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-1 h-2 rounded-b-card bg-surface-raised/70 blur-[1px]"
              />

              <span className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-pill bg-black/75 px-2.5 py-1 text-2xs font-semibold text-white backdrop-blur-sm">
                <ListVideo className="size-3" aria-hidden />
                {playlist.itemCount !== null ? `${formatCompactNumber(playlist.itemCount)} videos` : 'Playlist'}
              </span>
            </div>

            <h3 className="mt-3 line-clamp-2 font-display text-sm font-semibold leading-snug tracking-[-0.01em] group-hover:text-primary">
              {playlist.title}
            </h3>
            {playlist.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-foreground-subtle">{playlist.description}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
