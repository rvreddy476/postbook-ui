'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Search, Send, Users, X } from 'lucide-react';

import { searchUsers } from '@/services/userService';
import { createGroupConversation, getOrCreateDirectConversation, sendMessage } from '@/services/messageService';
import { getSession } from '@/services/authService';
import type { User } from '@/types';
import type { InboxMember, InboxRow } from '@/lib/chat/contract';
import { conversationIdOf, sendPostErrorText, sendPostToUser } from './sendPost';
import { InboxAvatar } from './inbox/InboxAvatar';
import { groupTitleFor, toggleRecipient, MAX_GROUP_PICK } from './newMessagePicker';

interface NewMessageSheetProps {
  onClose: () => void;
  /** Called once the conversation exists, so the parent can open it. */
  onOpened: (user: User, conversationId?: string) => void;
  /** Several people picked: a group chat was created (CONTRACT §9 "multi-select → group"). */
  onOpenedGroup?: (conversationId: string, title: string, members: InboxMember[]) => void;
  /** Recent chats, shown before anything is typed. */
  recents?: InboxRow[];
  /**
   * "Send in Messages" (audit T-25): the same picker, but committing shares
   * this post into the chat ({type:"post", post_id, text?}) and the text
   * becomes an optional caption. One recipient only. onOpened then means "sent".
   */
  sharePostId?: string;
}

/**
 * Start a conversation: recent chats and people search, pick one person for
 * a direct chat or several for a group. Nothing is created until you commit,
 * so picking the wrong person leaves no empty conversation behind.
 */
export default function NewMessageSheet({ onClose, onOpened, onOpenedGroup, recents = [], sharePostId }: NewMessageSheetProps) {
  const sharing = Boolean(sharePostId);
  const myId = getSession()?.id ?? '';
  const max = sharing || !onOpenedGroup ? 1 : MAX_GROUP_PICK;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Debounced search; a slow earlier response cannot overwrite a newer one.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const found = await searchUsers(q, 10);
      if (cancelled) return;
      setResults(found.filter((u) => u.id && u.id !== myId));
      setSearching(false);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [query, myId]);

  /** People from recent direct chats, newest first. */
  const recentPeople = useMemo<User[]>(() => {
    const out: User[] = [];
    const seen = new Set<string>();
    for (const r of recents) {
      if (r.isGroup || !r.peer || seen.has(r.peer.userId) || r.peer.userId === myId) continue;
      seen.add(r.peer.userId);
      out.push({ id: r.peer.userId, name: r.peer.displayName, username: r.peer.username ?? undefined, avatar: r.peer.avatarUrl ?? '', isOnline: r.peer.isOnline === true });
      if (out.length >= 15) break;
    }
    return out;
  }, [recents, myId]);

  const pickedIds = new Set(picked.map((p) => p.id));
  const toggle = (u: User) => {
    setError(null);
    setPicked((prev) => toggleRecipient(prev, u, max));
    if (max === 1) setTimeout(() => messageRef.current?.focus(), 0);
  };

  const isGroup = picked.length >= 2;

  const commit = async () => {
    if (picked.length === 0 || sending) return;
    setSending(true);
    setError(null);
    const first = picked[0];
    if (sharePostId) {
      try {
        await sendPostToUser(first.id, sharePostId, text);
        onOpened(first);
        onClose();
      } catch (err) {
        setError(sendPostErrorText(err, first.name));
      } finally {
        setSending(false);
      }
      return;
    }
    try {
      if (isGroup && onOpenedGroup) {
        const title = groupTitleFor(groupName, picked);
        const res: any = await createGroupConversation(title, picked.map((p) => p.id));
        const conversationId = conversationIdOf(res);
        if (!conversationId) throw new Error('no conversation id');
        if (text.trim()) await sendMessage(conversationId, text.trim());
        onOpenedGroup(
          conversationId,
          title,
          picked.map((p) => ({ userId: p.id, role: null, displayName: p.name, avatarMediaId: null, lastReadAt: null })),
        );
        onClose();
        return;
      }
      const res: any = await getOrCreateDirectConversation(first.id);
      const conversationId = conversationIdOf(res);
      if (!conversationId) throw new Error('no conversation id');
      if (text.trim()) await sendMessage(conversationId, text.trim());
      onOpened(first, conversationId);
      onClose();
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      const refused = err?.status === 403 || /\(403\)|forbidden|not allowed|permission|privacy|cannot message|can't message|blocked/i.test(msg);
      setError(
        refused
          ? isGroup
            ? "Some of these people can't be added to a group by you."
            : `${first.name.split(' ')[0] || 'They'} is not accepting messages from you.`
          : isGroup ? "Couldn't create the group. Try again." : 'Could not start the conversation. Try again.',
      );
    } finally {
      setSending(false);
    }
  };

  const q = query.trim();
  const list = q ? results : recentPeople;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
      className="absolute inset-0 z-20 flex flex-col bg-brand-bg"
      role="dialog"
      aria-label={sharing ? 'Send in Messages' : 'New message'}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold -tracking-[0.014em] text-brand-text">{sharing ? 'Send to' : isGroup ? 'New group' : 'New message'}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* To: chips, then the search field */}
      <div className="mx-4 flex flex-wrap items-center gap-1.5 border-b border-brand-divider pb-2">
        <span className="text-[13px] text-muted-foreground">To</span>
        {picked.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint py-0.5 pl-0.5 pr-2 text-[13px] text-brand-text">
            <InboxAvatar name={p.name} src={p.avatar} size={22} />
            <span className="max-w-[120px] truncate font-medium">{p.name}</span>
            <button onClick={() => toggle(p)} aria-label={`Remove ${p.name}`} className="text-brand-text/50 hover:text-brand-text">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {picked.length < max && (
          <div className="relative min-w-[120px] flex-1">
            <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/35" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { toggle(list[0]); setQuery(''); } }}
              placeholder={picked.length ? 'Add more people' : 'Search people'}
              className="w-full bg-transparent py-1.5 pl-6 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40"
            />
          </div>
        )}
      </div>

      {isGroup && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl bg-brand-secondary px-3">
          <Users className="h-4 w-4 text-brand-text/40" />
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            maxLength={80}
            placeholder="Name the group (optional)"
            className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
        {searching && (
          <div className="flex items-center justify-center py-8 text-brand-text/40">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!searching && q && results.length === 0 && (
          <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">No people match &ldquo;{q}&rdquo;.</p>
        )}
        {!q && recentPeople.length > 0 && (
          <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">Recent</p>
        )}
        {!q && recentPeople.length === 0 && (
          <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">Search by name or username.</p>
        )}
        {!searching && list.map((u) => {
          const on = pickedIds.has(u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              aria-pressed={on}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-brand-secondary"
            >
              <InboxAvatar name={u.name} src={u.avatar} size={40} online={u.isOnline === true} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-brand-text">{u.name}</p>
                {u.username && <p className="truncate text-[12px] text-muted-foreground">@{u.username}</p>}
              </div>
              {max > 1 && (
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? 'border-primary-ink bg-primary-ink text-white' : 'border-brand-divider'}`}>
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              )}
            </button>
          );
        })}
        {picked.length >= max && max > 1 && (
          <p className="px-3 pt-2 text-[12px] text-brand-text/50">You can add up to {max} people here; add more from the group later.</p>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-[12px] text-danger" role="alert">{error}</p>}

      <div className="border-t border-brand-divider p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); void commit(); }}
          className={`flex items-center gap-1 rounded-full bg-brand-secondary pl-4 pr-1.5 ring-1 ring-transparent transition-colors focus-within:ring-brand-divider ${picked.length ? '' : 'opacity-50'}`}
        >
          <input
            ref={messageRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!picked.length || sending}
            maxLength={2000}
            placeholder={picked.length ? (sharing ? 'Add a message (optional)' : isGroup ? 'Say hello to the group (optional)' : 'Write a message') : 'Choose someone first'}
            className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40 disabled:cursor-not-allowed"
          />
          {picked.length > 0 && !text.trim() && !sharing ? (
            <button type="submit" disabled={sending} className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold text-primary-ink transition-colors hover:bg-brand-bg">
              {sending ? (isGroup ? 'Creating…' : 'Opening…') : isGroup ? 'Create group' : 'Open chat'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!picked.length || (!text.trim() && !sharing) || sending}
              aria-label={sharing ? 'Send post' : 'Send message'}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:scale-90 ${picked.length && (text.trim() || sharing)
                ? 'bg-send text-white hover:bg-send-hover'
                : 'text-brand-text/30'
                }`}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-[18px] w-[18px] -ml-px" strokeWidth={1.75} />}
            </button>
          )}
        </form>
      </div>
    </motion.div>
  );
}
