'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Bookmark, Check, FolderPlus, Loader2, X } from 'lucide-react';
import { useCollections, useCreateCollection } from '@/hooks/useSavedItems';
import {
  COLLECTION_NAME_PROBLEM_TEXT,
  MAX_COLLECTION_NAME_LENGTH,
  canCreateCollection,
  collectionNameProblem,
  savedErrorText,
} from './savedCollections';

export interface SaveToCollectionSheetProps {
  /** "Save to collection" from a post, "Move to collection" from /saved. */
  title: string;
  /** The collection the item is in now (null = All Saved), when known; it is marked and not offered. */
  currentCollectionId?: string | null;
  /** True while the pick is being sent. */
  busy: boolean;
  /** The refusal of the last pick, as a sentence. */
  error: string | null;
  onPick: (collection: { id: string | null; name: string }) => void;
  onClose: () => void;
}

/**
 * The collection picker: All Saved, the viewer's collections, and New
 * collection (created, then picked). A bottom sheet on a phone, a dialog
 * on a wide screen — the EditPostSheet frame.
 */
export default function SaveToCollectionSheet({ title, currentCollectionId, busy, error, onPick, onClose }: SaveToCollectionSheetProps) {
  const titleId = useId();
  const inputId = useId();
  const collections = useCollections();
  const create = useCreateCollection();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const working = busy || create.isPending;
  const list = collections.data ?? [];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    if (creating) inputRef.current?.focus({ preventScroll: true });
  }, [creating]);

  const submitNew = async () => {
    const check = collectionNameProblem(name, list);
    if (!check.ok) {
      setProblem(COLLECTION_NAME_PROBLEM_TEXT[check.problem]);
      return;
    }
    try {
      const created = await create.mutateAsync(check.name);
      setCreating(false);
      setName('');
      setProblem(null);
      onPick({ id: created.id, name: created.name });
    } catch (err) {
      setProblem(savedErrorText(err, 'create'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-120 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-brand-divider bg-brand-card shadow-xl sm:mx-4 sm:rounded-2xl"
        onKeyDown={(event) => { if (event.key === 'Escape' && !working) { event.stopPropagation(); onClose(); } }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-divider bg-brand-card px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-brand-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            aria-label="Close"
            className="rounded-full p-1.5 text-brand-text/60 hover:bg-brand-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-3">
          {error && (
            <p role="alert" className="mx-2 mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          {collections.isLoading ? (
            <p role="status" className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              Loading your collections…
            </p>
          ) : collections.isError ? (
            <div role="alert" className="px-3 py-4 text-sm text-brand-text">
              <p>{savedErrorText(collections.error, 'load')}</p>
              <button type="button" onClick={() => void collections.refetch()} className="mt-2 font-semibold text-primary-ink hover:underline">
                Try again
              </button>
            </div>
          ) : (
            <ul className="space-y-0.5" aria-label="Collections">
              {list.map((c) => {
                const current = currentCollectionId !== undefined && c.id === currentCollectionId;
                return (
                  <li key={c.id ?? 'default'}>
                    <button
                      type="button"
                      disabled={working || current}
                      aria-current={current || undefined}
                      onClick={() => onPick({ id: c.id, name: c.name })}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-brand-secondary disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary-ink" aria-hidden="true">
                        <Bookmark className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-brand-text">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.count === 1 ? '1 item' : `${c.count.toLocaleString('en-US')} items`}
                        </span>
                      </span>
                      {current && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-ink">
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Here now
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!collections.isLoading && !collections.isError && (
            <div className="mt-2 border-t border-brand-divider px-2 pt-3">
              {creating ? (
                <form
                  onSubmit={(event) => { event.preventDefault(); void submitNew(); }}
                  className="space-y-2"
                >
                  <label htmlFor={inputId} className="block text-sm font-medium text-brand-text">New collection</label>
                  <div className="flex gap-2">
                    <input
                      id={inputId}
                      ref={inputRef}
                      value={name}
                      maxLength={MAX_COLLECTION_NAME_LENGTH * 2}
                      placeholder="Name it"
                      disabled={working}
                      onChange={(event) => { setName(event.target.value); setProblem(null); }}
                      className="min-w-0 flex-1 rounded-xl border border-brand-divider bg-brand-bg px-3 py-2 text-sm text-brand-text focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <button
                      type="submit"
                      disabled={working || !name.trim()}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                    >
                      {create.isPending ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                  {problem && <p role="alert" className="text-xs text-danger">{problem}</p>}
                </form>
              ) : canCreateCollection(list) ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  disabled={working}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-sm font-semibold text-primary-ink hover:bg-brand-secondary disabled:opacity-50"
                >
                  <FolderPlus className="h-5 w-5" aria-hidden="true" />
                  New collection
                </button>
              ) : (
                <p className="px-1 py-2 text-xs text-muted-foreground">{COLLECTION_NAME_PROBLEM_TEXT.limit}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
