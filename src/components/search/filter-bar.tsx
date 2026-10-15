'use client';

import { ArrowDownWideNarrow, CalendarClock, ChevronDown, Timer, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';
import type { DurationFilter, SearchOrder, UploadWindow } from '@/lib/youtube/models';

const ORDER_LABELS: Record<SearchOrder, string> = {
  relevance: 'Relevance',
  date: 'Newest first',
  viewCount: 'Most viewed',
  rating: 'Top rated',
  title: 'Title A–Z',
};

const DURATION_LABELS: Record<DurationFilter, string> = {
  any: 'Any length',
  short: 'Under 4 minutes',
  medium: '4 – 20 minutes',
  long: 'Over 20 minutes',
};

const UPLOAD_LABELS: Record<UploadWindow, string> = {
  any: 'Any time',
  hour: 'Past hour',
  today: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

interface FilterSelectProps<T extends string> {
  label: string;
  icon: React.ReactNode;
  value: T;
  options: Record<T, string>;
  defaultValue: T;
  onChange: (value: T) => void;
}

function FilterSelect<T extends string>({
  label,
  icon,
  value,
  options,
  defaultValue,
  onChange,
}: FilterSelectProps<T>) {
  const active = value !== defaultValue;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? 'subtle' : 'outline'}
          size="sm"
          pill
          aria-label={`${label}: ${options[value]}`}
          className={active ? 'text-primary' : undefined}
        >
          {icon}
          <span>{active ? options[value] : label}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {(Object.keys(options) as T[]).map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {options[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface SearchFilterBarProps {
  q: string;
  order: SearchOrder;
  duration: DurationFilter;
  uploaded: UploadWindow;
}

/**
 * Search refinements.
 *
 * Filters live in the URL, not in component state: results stay shareable, the
 * back button works, and the server can render the filtered page directly (which
 * also means the cache key is derived from something stable).
 */
export function SearchFilterBar({ q, order, duration, uploaded }: SearchFilterBarProps) {
  const router = useRouter();

  const push = React.useCallback(
    (next: Partial<{ order: SearchOrder; duration: DurationFilter; uploaded: UploadWindow }>) => {
      router.replace(routes.search({ q, order, duration, uploaded, ...next }), { scroll: false });
    },
    [router, q, order, duration, uploaded],
  );

  const dirty = order !== 'relevance' || duration !== 'any' || uploaded !== 'any';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label="Sort"
        icon={<ArrowDownWideNarrow aria-hidden />}
        value={order}
        options={ORDER_LABELS}
        defaultValue="relevance"
        onChange={(value) => push({ order: value })}
      />
      <FilterSelect
        label="Length"
        icon={<Timer aria-hidden />}
        value={duration}
        options={DURATION_LABELS}
        defaultValue="any"
        onChange={(value) => push({ duration: value })}
      />
      <FilterSelect
        label="Uploaded"
        icon={<CalendarClock aria-hidden />}
        value={uploaded}
        options={UPLOAD_LABELS}
        defaultValue="any"
        onChange={(value) => push({ uploaded: value })}
      />

      {dirty ? (
        <Button
          variant="ghost"
          size="sm"
          pill
          onClick={() => push({ order: 'relevance', duration: 'any', uploaded: 'any' })}
        >
          <X aria-hidden />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
