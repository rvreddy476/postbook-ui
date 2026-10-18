'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { SeenByEntry } from '@/lib/chat/contract';
import { fetchReadSummary } from '@/services/chatParityApi';
import { PickerSheetShell } from './PickerSheetShell';
import { PersonAvatar } from './ReactionsSheet';
import { seenAtLabel, seenByTitle } from './pickerSheetModels';

type State =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'failed' }
  | { kind: 'ready'; seenBy: SeenByEntry[]; count: number };

/*
  Who has seen a message in a group (CONTRACT §2.9): "Seen by N" and the
  people, newest first as the server sends them, with when. A server without
  the route yet says "Not available yet".
*/
export function SeenBySheet({ conversationId, messageId, onClose }: { conversationId: string; messageId: string; onClose(): void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchReadSummary(conversationId, messageId)
      .then((r) => {
        if (cancelled) return;
        setState(r === null ? { kind: 'unavailable' } : { kind: 'ready', seenBy: r.seenBy, count: r.count });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, messageId]);

  const title = state.kind === 'ready' ? seenByTitle(state.count) : 'Seen by';

  return (
    <PickerSheetShell title={title} onClose={onClose}>
      {state.kind === 'loading' && (
        <div className="flex items-center justify-center py-10 text-brand-text/40">
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />
        </div>
      )}
      {state.kind === 'unavailable' && <p className="px-4 py-10 text-center text-[13px] text-brand-text/60">Not available yet</p>}
      {state.kind === 'failed' && <p className="px-4 py-10 text-center text-[13px] text-brand-text/60">Couldn&rsquo;t load who has seen this. Try again.</p>}
      {state.kind === 'ready' && state.seenBy.length === 0 && (
        <p className="px-4 py-10 text-center text-[13px] text-brand-text/60">No one has seen this yet.</p>
      )}
      {state.kind === 'ready' && state.seenBy.length > 0 && (
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {state.seenBy.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
              <PersonAvatar user={p} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-brand-text">{p.displayName}</span>
              <span className="shrink-0 text-[11px] text-brand-text/60">{seenAtLabel(p.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </PickerSheetShell>
  );
}

export default SeenBySheet;
