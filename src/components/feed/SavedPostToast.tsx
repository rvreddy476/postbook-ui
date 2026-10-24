'use client';

import React from 'react';
import { Bookmark, FolderPlus } from 'lucide-react';

/*
  The body of the "Saved" toast (the HiddenPostToast frame): a save lands in
  All Saved, and the toast offers the collection picker straight away, the
  way Instagram's "Save to collection" bar does.
*/
export default function SavedPostToast({ onChoose }: { onChoose: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 pl-4 pr-9">
      <Bookmark className="h-4 w-4 shrink-0 fill-current text-primary-ink" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-text">Saved</p>
        <p className="mt-0.5 text-xs text-brand-text/60">In All Saved.</p>
      </div>
      <button
        type="button"
        onClick={onChoose}
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-primary-ink transition-colors hover:bg-brand-secondary"
      >
        <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
        Save to collection
      </button>
    </div>
  );
}
