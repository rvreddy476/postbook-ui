'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, Users, X } from 'lucide-react';

import { FORWARD_MAX_TARGETS } from '@/lib/chat/contract';
import { fetchInbox } from '@/services/chatParityApi';
import { getSession } from '@/services/authService';
import { searchUsers } from '@/services/userService';
import type { User } from '@/types';
import {
  isPicked,
  pickerTargets,
  pickLimit,
  pickLimitHint,
  searchResults,
  toggleTarget,
  type ChatTarget,
} from './chatTargets';

export type { ChatTarget } from './chatTargets';

/*
  Pick up to five chats to send something to (share a post, forward a
  message). Recent chats — DMs and groups, never dating chats — sit in an
  avatar row; search finds more chats and people. A person with no chat yet
  is picked as a person; the chat is opened only when the caller sends.
*/

const RECENT_COUNT = 10;

interface ChatTargetPickerProps {
  /** Default FORWARD_MAX_TARGETS (5); never more. */
  max?: number;
  selected: ChatTarget[];
  onChange(next: ChatTarget[]): void;
  /** Default true. */
  includeGroups?: boolean;
  excludeConversationIds?: string[];
}

function TargetAvatar({ t, size }: { t: ChatTarget; size: 'sm' | 'md' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  const box = size === 'lg' ? 'h-12 w-12' : size === 'md' ? 'h-9 w-9' : 'h-5 w-5';
  const letter = size === 'sm' ? 'text-[9px]' : 'text-[12px]';
  return (
    <span className={`${box} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-secondary`}>
      {t.avatarUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : t.isGroup ? (
        <Users className={size === 'sm' ? 'h-3 w-3 text-brand-text/60' : 'h-4 w-4 text-brand-text/60'} aria-hidden />
      ) : (
        <span className={`${letter} font-semibold text-brand-text/60`}>{(t.name || '?').trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

export function ChatTargetPicker({
  max = FORWARD_MAX_TARGETS,
  selected,
  onChange,
  includeGroups = true,
  excludeConversationIds,
}: ChatTargetPickerProps) {
  const limit = pickLimit(max);
  const myId = getSession()?.id ?? '';
  const excludeKey = (excludeConversationIds ?? []).join(',');

  const [chats, setChats] = useState<ChatTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [limitFlash, setLimitFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    fetchInbox(myId, { limit: 50 })
      .then((page) => {
        if (cancelled) return;
        setChats(pickerTargets(page.rows, myId, { includeGroups, excludeConversationIds: excludeKey ? excludeKey.split(',') : [] }));
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [myId, includeGroups, excludeKey]);

  // People search, debounced; a slow earlier answer never overwrites a newer query.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setPeople([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const found = await searchUsers(q, 8);
      if (cancelled) return;
      setPeople(found);
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const atLimit = selected.length >= limit;

  const toggle = (t: ChatTarget) => {
    const r = toggleTarget(selected, t, limit);
    if (r.atLimit) {
      setLimitFlash(true);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setLimitFlash(false), 2400);
      return;
    }
    onChange(r.next);
  };

  const q = query.trim();
  const recents = chats.slice(0, RECENT_COUNT);
  const list = useMemo(
    () => (q ? searchResults(chats, q, people, myId) : chats.slice(RECENT_COUNT)),
    [q, chats, people, myId],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Recent chats */}
      {loading ? (
        <div className="flex items-center justify-center py-5 text-brand-text/40">
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading chats" />
        </div>
      ) : loadFailed ? (
        <p className="px-4 py-3 text-[12px] text-brand-text/60">Couldn&rsquo;t load your chats. You can still search.</p>
      ) : recents.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 pt-1 scrollbar-hide" role="group" aria-label="Recent chats">
          {recents.map((t) => {
            const picked = isPicked(selected, t);
            const disabled = !picked && atLimit;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => toggle(t)}
                aria-pressed={picked}
                aria-label={picked ? `Remove ${t.name}` : `Pick ${t.name}`}
                className={`flex w-14 shrink-0 flex-col items-center gap-1 ${disabled ? 'opacity-40' : ''}`}
              >
                <span className={`relative rounded-full ${picked ? 'ring-2 ring-primary-ink' : ''}`}>
                  <TargetAvatar t={t} size="lg" />
                  {t.isOnline && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success ring-2 ring-brand-card" aria-hidden />
                  )}
                  {picked && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-ink text-white ring-2 ring-brand-card" aria-hidden>
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center text-[11px] text-brand-text">{t.name}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-3 text-[12px] text-brand-text/60">No chats yet. Search for people.</p>
      )}

      {/* Picked */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2" aria-label="Picked">
          {selected.map((t) => (
            <span key={t.key} className="inline-flex items-center gap-1 rounded-full bg-primary-tint py-0.5 pl-0.5 pr-1.5 text-[12px] text-brand-text">
              <TargetAvatar t={t} size="sm" />
              <span className="max-w-[7rem] truncate font-medium">{t.name}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s.key !== t.key))}
                aria-label={`Remove ${t.name}`}
                className="text-brand-text/50 hover:text-brand-text"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {(atLimit || limitFlash) && (
        <p className={`px-4 pb-1 text-[11px] ${limitFlash ? 'text-danger' : 'text-brand-text/60'}`} role="status">
          {pickLimitHint(limit)}
        </p>
      )}

      {/* Search */}
      <div className="mx-4 mb-1 flex items-center gap-2 rounded-full bg-brand-secondary px-3">
        <Search className="h-4 w-4 shrink-0 text-brand-text/40" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search chats and people"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-brand-text/50 hover:text-brand-text">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results (or the rest of the chats) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 scrollbar-hide">
        {q && searching && list.length === 0 && (
          <div className="flex items-center justify-center py-6 text-brand-text/40">
            <Loader2 className="h-4 w-4 animate-spin" aria-label="Searching" />
          </div>
        )}
        {q && !searching && list.length === 0 && (
          <p className="px-3 py-6 text-center text-[12px] text-brand-text/60">No chats or people match &ldquo;{q}&rdquo;.</p>
        )}
        {list.map((t) => {
          const picked = isPicked(selected, t);
          const disabled = !picked && atLimit;
          return (
            <button
              key={t.key}
              type="button"
              role="checkbox"
              aria-checked={picked}
              aria-disabled={disabled}
              onClick={() => toggle(t)}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-brand-secondary ${disabled ? 'opacity-40' : ''}`}
            >
              <span className="relative">
                <TargetAvatar t={t} size="md" />
                {t.isOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-brand-card" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-brand-text">{t.name}</span>
                {t.subtitle && <span className="block truncate text-[11px] text-brand-text/60">{t.subtitle}</span>}
              </span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${picked ? 'border-primary-ink bg-primary-ink text-white' : 'border-brand-divider'}`}
                aria-hidden
              >
                {picked && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ChatTargetPicker;
