'use client';

import React, { useState } from 'react';
import { EyeOff, Undo2 } from 'lucide-react';

/*
  The body of the "Hidden" toast. A toast with customContent draws nothing of
  its own except the close button, so this carries the title, the line under
  it and the Undo control.

  Undo can only be pressed once: the toast outlives the card that hid the
  post, so the button carries its own state rather than the card's.
*/
export default function HiddenPostToast({ onUndo }: { onUndo: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  const undo = async () => {
    if (state !== 'idle') return;
    setState('busy');
    try {
      await onUndo();
      setState('done');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="flex items-center gap-3 py-3 pl-4 pr-9">
      <EyeOff className="h-4 w-4 shrink-0 text-brand-text/60" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-text">
          {state === 'done' ? 'Restored' : 'Hidden'}
        </p>
        <p className="mt-0.5 text-xs text-brand-text/60">
          {state === 'done'
            ? "We'll keep showing posts like this."
            : state === 'failed'
              ? "Couldn't undo that. It will be back on your next refresh."
              : "We'll show you less like this."}
        </p>
      </div>
      {state !== 'done' && (
        <button
          type="button"
          onClick={undo}
          disabled={state === 'busy'}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-primary-ink transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
      )}
    </div>
  );
}
