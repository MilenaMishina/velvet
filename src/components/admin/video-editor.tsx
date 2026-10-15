'use client';

import { Loader2, Plus, Save, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useAdminAction } from '@/components/admin/use-admin-action';

export interface EditableVideo {
  id: string;
  title: string;
  pageUrl: string;
  sourceId: string;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  embedType: string;
  tags: string[];
  description: string | null;
  status: string;
  pinned: boolean;
}

export interface SourceOption {
  id: string;
  name: string;
}

const EMBED_TYPES = ['video', 'iframe', 'link'] as const;

const EMPTY = {
  title: '',
  pageUrl: '',
  sourceId: '',
  thumbnailUrl: '',
  embedUrl: '',
  embedType: 'video',
  tags: '',
  description: '',
};

/**
 * Add or edit a video by hand.
 *
 * The same form for both, because creating and editing take exactly the same
 * fields — the only differences are which endpoint action fires and whether the
 * page URL has to be unique. Auto-detect picks the player mode from the embed URL
 * so the common case (paste an mp4 or an embed link) needs no decisions.
 */
export function VideoEditor({
  sources,
  editing,
  onClose,
}: {
  sources: SourceOption[];
  /** `null` means "create new"; otherwise the video being edited. */
  editing: EditableVideo | 'new' | null;
  onClose: () => void;
}) {
  const { run, busy, error } = useAdminAction();
  const isNew = editing === 'new';
  const [form, setForm] = React.useState(EMPTY);

  React.useEffect(() => {
    if (editing === 'new') {
      setForm({ ...EMPTY, sourceId: sources[0]?.id ?? '' });
    } else if (editing) {
      setForm({
        title: editing.title,
        pageUrl: editing.pageUrl,
        sourceId: editing.sourceId,
        thumbnailUrl: editing.thumbnailUrl ?? '',
        embedUrl: editing.embedUrl ?? '',
        embedType: editing.embedType,
        tags: editing.tags.join(', '),
        description: editing.description ?? '',
      });
    }
  }, [editing, sources]);

  if (!editing) return null;

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  // Auto-detect only while creating or when the field is still untouched-by-hand;
  // guessing over a deliberate choice would be worse than not guessing at all.
  const onEmbedUrl = (value: string) => {
    setForm((current) => {
      const detected = /\.(mp4|webm|m3u8)(\?|$)/i.test(value) ? 'video' : /^https?:/i.test(value) ? 'iframe' : current.embedType;
      return { ...current, embedUrl: value, embedType: value.trim() === '' ? 'link' : detected };
    });
  };

  const save = async () => {
    if (isNew) {
      const data = await run<{ id: string }>(
        'save',
        '/api/admin/videos',
        {
          action: 'create',
          sourceId: form.sourceId,
          title: form.title,
          pageUrl: form.pageUrl,
          thumbnailUrl: form.thumbnailUrl,
          embedUrl: form.embedUrl,
          embedType: form.embedType,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          description: form.description,
        },
        'Video added.',
      );
      if (data) onClose();
      return;
    }
    if (!editing) return;
    const ok = await run<{ ok: boolean }>('save', '/api/admin/videos', {
      action: 'update',
      id: editing.id,
      ...form,
    });
    if (ok !== null) onClose();
  };

  return (
    <div className="panel space-y-4 rounded-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold">{isNew ? 'Add a video' : 'Edit video'}</h3>
        <Button variant="ghost" size="icon-sm" aria-label="Close editor" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="v-title" label="Title" value={form.title} onChange={set('title')} placeholder="Video title" />
        <div className="space-y-1.5">
          <label htmlFor="v-source" className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
            Section
          </label>
          <select
            id="v-source"
            value={form.sourceId}
            onChange={(event) => set('sourceId')(event.target.value)}
            className="panel h-10 w-full rounded-control px-3 text-sm outline-none focus:shadow-glow"
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="v-page"
          label="Page URL"
          value={form.pageUrl}
          onChange={set('pageUrl')}
          placeholder="https://site/post/…"
          hint="Also the row's identity — two videos can't share one."
        />
        <Field id="v-thumb" label="Thumbnail URL" value={form.thumbnailUrl} onChange={set('thumbnailUrl')} placeholder="https://…/poster.jpg" />
        <Field
          id="v-embed"
          label="Embed URL"
          value={form.embedUrl}
          onChange={onEmbedUrl}
          placeholder="https://…/video.mp4 or a player page"
          hint="An mp4 plays natively; anything else is framed."
        />
        <div className="space-y-1.5">
          <span className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Player mode</span>
          <div className="flex flex-wrap gap-2">
            {EMBED_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={form.embedType === type}
                onClick={() => set('embedType')(type)}
                className={
                  form.embedType === type
                    ? 'brand-gradient rounded-pill px-3 py-1.5 text-xs font-semibold text-primary-foreground'
                    : 'panel rounded-pill px-3 py-1.5 text-xs font-semibold text-foreground-muted hover:text-foreground'
                }
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <Field id="v-tags" label="Tags (comma separated)" value={form.tags} onChange={set('tags')} placeholder="desi, leaked" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="v-desc" className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
          Description
        </label>
        <textarea
          id="v-desc"
          rows={3}
          value={form.description}
          onChange={(event) => set('description')(event.target.value)}
          className="panel w-full resize-y rounded-control px-3 py-2 text-sm outline-none focus:shadow-glow"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/12 px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="md" pill onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="md" pill disabled={busy !== null || !form.title.trim()} onClick={() => void save()}>
          {busy === 'save' ? <Loader2 className="animate-spin" aria-hidden /> : isNew ? <Plus aria-hidden /> : <Save aria-hidden />}
          {isNew ? 'Add video' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="panel h-10 w-full rounded-control px-3 text-sm outline-none focus:shadow-glow"
      />
      {hint ? <p className="text-2xs text-foreground-subtle">{hint}</p> : null}
    </div>
  );
}
