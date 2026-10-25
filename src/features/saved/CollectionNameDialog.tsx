'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  COLLECTION_NAME_PROBLEM_TEXT,
  MAX_COLLECTION_NAME_LENGTH,
  collectionNameProblem,
  normalizeCollectionName,
  type SavedCollectionView,
} from './savedCollections';

export interface CollectionNameDialogProps {
  mode: 'create' | 'rename';
  /** The collection being renamed. */
  collection?: SavedCollectionView;
  collections: readonly SavedCollectionView[];
  busy: boolean;
  /** The server's refusal as a sentence. */
  error: string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** Name a new collection, or rename one. The rules are checked before anything is sent. */
export default function CollectionNameDialog({ mode, collection, collections, busy, error, onSubmit, onClose }: CollectionNameDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(collection?.name ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const length = Array.from(normalizeCollectionName(name)).length;
  const unchanged = mode === 'rename' && normalizeCollectionName(name) === collection?.name;

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }, []);

  const submit = () => {
    if (unchanged) {
      onClose();
      return;
    }
    const check = collectionNameProblem(name, collections, mode === 'rename' ? collection?.id ?? undefined : undefined);
    if (!check.ok) {
      setProblem(COLLECTION_NAME_PROBLEM_TEXT[check.problem]);
      return;
    }
    onSubmit(check.name);
  };

  const shown = problem ?? error;

  return (
    <div
      className="fixed inset-0 z-120 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-t-2xl border border-brand-divider bg-brand-card shadow-xl sm:mx-4 sm:rounded-2xl"
        onKeyDown={(event) => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); } }}
      >
        <div className="flex items-center justify-between border-b border-brand-divider px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-brand-text">
            {mode === 'create' ? 'New collection' : 'Rename collection'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-full p-1.5 text-brand-text/60 hover:bg-brand-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <form
          className="space-y-4 p-5"
          onSubmit={(event) => { event.preventDefault(); submit(); }}
        >
          <div>
            <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-brand-text">Name</label>
            <input
              id={inputId}
              ref={inputRef}
              value={name}
              maxLength={MAX_COLLECTION_NAME_LENGTH * 2}
              disabled={busy}
              aria-describedby={hintId}
              aria-invalid={!!shown || undefined}
              onChange={(event) => { setName(event.target.value); setProblem(null); }}
              className="w-full rounded-xl border border-brand-divider bg-brand-bg px-3 py-2 text-base text-brand-text focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p id={hintId} className={`mt-1 text-right text-xs tabular-nums ${length > MAX_COLLECTION_NAME_LENGTH ? 'text-danger' : 'text-brand-text/55'}`}>
              {length} / {MAX_COLLECTION_NAME_LENGTH}
            </p>
            {shown && <p role="alert" className="mt-1 text-sm text-danger">{shown}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? 'Saving…' : mode === 'create' ? 'Create' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
