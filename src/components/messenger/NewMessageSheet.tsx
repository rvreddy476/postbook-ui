'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Search, Send, X } from 'lucide-react';

import { searchUsers } from '@/services/userService';
import { getOrCreateDirectConversation, sendMessage } from '@/services/messageService';
import { getSession } from '@/services/authService';
import type { User } from '@/types';

interface NewMessageSheetProps {
  onClose: () => void;
  /** Called once the conversation exists, so the parent can open its window. */
  onOpened: (user: User) => void;
}

/**
 * Start a conversation with anyone, not only people already in your circle.
 *
 * Before this, the chat panel listed circle members and nothing else, so there
 * was no way to message someone you had not already connected with. This is a
 * "To:" field backed by the people search, then an optional first message.
 *
 * The conversation is created only when you commit — pressing send, or
 * "Open chat" with no text — never while you are browsing search results,
 * so picking the wrong person does not leave an empty conversation behind.
 */
export default function NewMessageSheet({ onClose, onOpened }: NewMessageSheetProps) {
  const myId = getSession()?.id ?? '';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<User | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());

  const searchRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => { if (recipient) messageRef.current?.focus(); }, [recipient]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Debounced search. Each run is tagged so a slow earlier response cannot
  // overwrite the results for what the user has typed since.
  useEffect(() => {
    if (recipient) return;
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const found = await searchUsers(q, 8);
      if (cancelled) return;
      setResults(found.filter((u) => u.id && u.id !== myId));
      setSearching(false);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [query, recipient, myId]);

  const choose = (u: User) => {
    setRecipient(u);
    setResults([]);
    setError(null);
  };

  const commit = async () => {
    if (!recipient || sending) return;
    setSending(true);
    setError(null);
    try {
      const res: any = await getOrCreateDirectConversation(recipient.id);
      // Take the first NON-EMPTY candidate. Go marshals missing fields as "",
      // so a plain ?? chain would keep an empty string and drop the real id.
      const conversationId = [
        res?.data?.conversation_id, res?.data?.id, res?.conversation_id, res?.id,
      ].find((v): v is string => typeof v === 'string' && v.length > 0);
      if (!conversationId) throw new Error('no conversation id');
      if (text.trim()) await sendMessage(conversationId, text.trim());
      onOpened(recipient);
      onClose();
    } catch (err: any) {
      // The chat client throws a plain Error carrying the server's message
      // (or "Chat API request failed (403)" when there is none) and no status
      // field, so refusal has to be read from the text.
      const msg = String(err?.message ?? '');
      const refused = /\(403\)|forbidden|not allowed|permission|privacy|cannot message|can't message|blocked/i.test(msg);
      setError(
        refused
          ? `${recipient.name.split(' ')[0] || 'They'} is not accepting messages from you.`
          : 'Could not start the conversation. Try again.',
      );
    } finally {
      setSending(false);
    }
  };

  const avatar = (u: User, size: string) => (
    <div className={`${size} shrink-0 overflow-hidden rounded-full bg-brand-secondary`}>
      {u.avatar && !brokenAvatars.has(u.id) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={u.avatar}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBrokenAvatars((p) => new Set(p).add(u.id))}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-brand-text/60">
          {(u.name || '?').trim().charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );

  const query_ = query.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
      className="absolute inset-0 z-20 flex flex-col bg-brand-bg"
      role="dialog"
      aria-label="New message"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-base font-semibold -tracking-[0.014em] text-brand-text">New message</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* To: — a chip once chosen, a search field until then */}
      <div className="mx-4 flex items-center gap-2 border-b border-brand-divider pb-2">
        <span className="text-sm text-muted-foreground">To</span>
        {recipient ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint py-0.5 pl-0.5 pr-2 text-sm text-brand-text">
            {avatar(recipient, 'h-6 w-6')}
            <span className="max-w-[140px] truncate font-medium">{recipient.name}</span>
            <button
              onClick={() => { setRecipient(null); setQuery(''); setError(null); setTimeout(() => searchRef.current?.focus(), 0); }}
              aria-label={`Remove ${recipient.name}`}
              className="text-brand-text/50 hover:text-brand-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <div className="relative flex-1">
            <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/35" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) choose(results[0]); }}
              placeholder="Search people"
              className="w-full bg-transparent py-1.5 pl-6 text-sm text-brand-text outline-hidden placeholder:text-brand-text/40"
            />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
        {!recipient && searching && (
          <div className="flex items-center justify-center py-8 text-brand-text/40">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!recipient && !searching && query_ && results.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">No people match &ldquo;{query_}&rdquo;.</p>
        )}
        {!recipient && !query_ && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">Search by name or username.</p>
        )}
        {!recipient && !searching && results.map((u) => (
          <button
            key={u.id}
            onClick={() => choose(u)}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-brand-secondary"
          >
            {avatar(u, 'h-9 w-9')}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-brand-text">{u.name}</p>
              {u.username && <p className="truncate text-xs text-muted-foreground">@{u.username}</p>}
            </div>
          </button>
        ))}
        {recipient && (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            {avatar(recipient, 'h-14 w-14')}
            <p className="mt-3 text-sm font-semibold text-brand-text">{recipient.name}</p>
            {recipient.username && <p className="text-xs text-muted-foreground">@{recipient.username}</p>}
            <p className="mt-3 text-xs text-muted-foreground">Write a first message, or open the chat without one.</p>
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-xs text-danger" role="alert">{error}</p>}

      {/* Composer — same shape as every other message composer in the app */}
      <div className="border-t border-brand-divider p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); commit(); }}
          className={`flex items-center gap-1 rounded-full bg-brand-secondary pl-4 pr-1.5 ring-1 ring-transparent transition-colors focus-within:ring-brand-divider ${recipient ? '' : 'opacity-50'}`}
        >
          <input
            ref={messageRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!recipient || sending}
            placeholder={recipient ? 'Write a message' : 'Choose someone first'}
            className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40 disabled:cursor-not-allowed"
          />
          {recipient && !text.trim() ? (
            <button
              type="submit"
              disabled={sending}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-primary-ink transition-colors hover:bg-brand-bg"
            >
              {sending ? 'Opening…' : 'Open chat'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!recipient || !text.trim() || sending}
              aria-label="Send message"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:scale-90 ${recipient && text.trim()
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
