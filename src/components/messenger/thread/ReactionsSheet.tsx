'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { ReactionGroup, ReactionUser } from '@/lib/chat/contract';
import { fetchReactionGroups } from '@/services/chatParityApi';
import { PickerSheetShell } from './PickerSheetShell';
import { fallbackReactionGroups, reactionTabs, reactorsFor } from './pickerSheetModels';

/*
  Who reacted to a message (CONTRACT §2.5): "All" plus one tab per emoji with
  its count. Names and photos come from the server's reactions route; until
  that route exists (or if it fails) the message's own reaction list is used,
  named from the thread's members.
*/
export function ReactionsSheet({
  conversationId,
  messageId,
  fallback,
  nameOf,
  avatarOf,
  onClose,
}: {
  conversationId: string;
  messageId: string;
  fallback: { emoji: string; user_ids: string[] }[];
  nameOf(userId: string): string;
  avatarOf?(userId: string): string | null;
  onClose(): void;
}) {
  const [groups, setGroups] = useState<ReactionGroup[] | null>(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    let cancelled = false;
    const local = () => fallbackReactionGroups(fallback, nameOf, avatarOf);
    fetchReactionGroups(conversationId, messageId)
      .then((g) => {
        if (!cancelled) setGroups(g && g.length > 0 ? g : local());
      })
      .catch(() => {
        if (!cancelled) setGroups(local());
      });
    return () => {
      cancelled = true;
    };
    // The fallback is a snapshot taken when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messageId]);

  const tabs = useMemo(() => reactionTabs(groups ?? []), [groups]);
  const people = useMemo(() => reactorsFor(groups ?? [], tab), [groups, tab]);

  return (
    <PickerSheetShell title="Reactions" onClose={onClose}>
      {groups === null ? (
        <div className="flex items-center justify-center py-10 text-brand-text/40">
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading reactions" />
        </div>
      ) : groups.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-brand-text/60">No reactions yet.</p>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-brand-divider px-4 pb-2 scrollbar-hide" role="tablist" aria-label="Reactions">
            {tabs.map((t) => {
              const on = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[13px] transition-colors ${
                    on ? 'bg-primary-tint font-semibold text-primary-ink' : 'text-brand-text/60 hover:bg-brand-secondary'
                  }`}
                >
                  {t.label} <span className="text-[12px]">{t.count}</span>
                </button>
              );
            })}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2" role="tabpanel">
            {people.map((p) => (
              <li key={p.user.userId} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                <PersonAvatar user={p.user} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-brand-text">{p.user.displayName}</span>
                <span className="shrink-0 text-[15px] leading-none" aria-label={`Reacted ${p.emojis.join(' ')}`}>
                  {p.emojis.join(' ')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </PickerSheetShell>
  );
}

export function PersonAvatar({ user }: { user: Pick<ReactionUser, 'displayName' | 'avatarUrl'> }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-secondary">
      {user.avatarUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-[12px] font-semibold text-brand-text/60">{(user.displayName || '?').trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

export default ReactionsSheet;
