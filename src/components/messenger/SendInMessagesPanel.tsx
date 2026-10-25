'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';

import { getSession } from '@/services/authService';
import type { User } from '@/types';
import { ChatTargetPicker, type ChatTarget } from './ChatTargetPicker';
import { shareSummary, shareToChats, type ShareOutcome } from './shareToChats';

/*
  "Send in Messages" inside a share sheet (CONTRACT §9): pick up to five
  chats — recent DMs and groups in an avatar row, or anyone by search — add
  an optional note, and press one Send. The post goes to every chat with the
  note as its caption (shareToChats.ts); each chat is judged by the server on
  its own, so a share can partly succeed. Then the panel either reports back
  through onSent (everything sent) or stays open with what failed and why,
  keeping only the failed chats picked so Send retries just those.
*/

const NOTE_MAX = 2000;

export function SendInMessagesPanel({
  postId,
  onBack,
  onSent,
}: {
  postId: string;
  /** ✕ / Escape: back to the share options. */
  onBack: () => void;
  /** Everything sent. `recipient.name` reads after "Sent to ": "Asha", "3 chats". */
  onSent: (recipient: User) => void;
}) {
  const [selected, setSelected] = useState<ChatTarget[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [failures, setFailures] = useState<ShareOutcome[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, sending]);

  const send = async () => {
    if (sending || selected.length === 0) return;
    setSending(true);
    setSummary(null);
    setFailures([]);
    setProgress({ done: 0, total: selected.length });
    try {
      const outcomes = await shareToChats(selected, postId, note, undefined, (done, total) => setProgress({ done, total }));
      const s = shareSummary(outcomes);
      if (s.failed === 0 && s.sent > 0) {
        const only = s.sent === 1 ? outcomes.find((o) => o.ok)?.target : undefined;
        onSent({ id: only?.userId ?? only?.conversationId ?? 'chats', name: s.label, avatar: only?.avatarUrl ?? '' });
        return;
      }
      setSummary(s.text);
      setFailures(outcomes.filter((o) => !o.ok));
      // Keep only what failed picked, so pressing Send again retries just those.
      const failedKeys = new Set(outcomes.filter((o) => !o.ok).map((o) => o.target.key));
      setSelected((cur) => cur.filter((t) => failedKeys.has(t.key)));
    } catch {
      setSummary("Couldn't send the post. Try again.");
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const count = selected.length;
  const label = sending && progress
    ? `Sending ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
    : count > 1
      ? `Send to ${count}`
      : 'Send';

  return (
    <div className="flex h-[26rem] max-h-[70vh] flex-col" role="region" aria-label="Send in Messages">
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <h4 className="text-[14px] font-semibold text-brand-text">Send to</h4>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to share options"
          className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ChatTargetPicker selected={selected} onChange={setSelected} />

      {summary && (
        <div className="mx-4 mb-1 rounded-xl bg-danger/10 px-3 py-2" role="alert">
          <p className="text-[12px] font-medium text-danger">{summary}</p>
          {failures.length > 1 && (
            <ul className="mt-1 space-y-0.5">
              {failures.map((f) => (
                <li key={f.target.key} className="text-[11px] text-brand-text/60">
                  <span className="font-medium text-brand-text">{f.target.name}:</span> {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-center gap-2 border-t border-brand-divider px-4 pt-3"
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          disabled={sending}
          placeholder="Add a note"
          aria-label="Add a note"
          className="min-w-0 flex-1 rounded-full bg-brand-secondary px-4 py-2 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={count === 0 || sending}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
            count > 0 && !sending ? 'bg-send text-white hover:bg-send-hover' : 'bg-brand-secondary text-brand-text/40'
          }`}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          {label}
        </button>
      </form>
    </div>
  );
}

/**
 * Whether the share sheet offers "Send in Messages": a post to send and a
 * signed-in viewer. Read after mount, so the server render never offers it.
 */
export function useCanSendInMessages(postId: string | null | undefined): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(getSession()?.id));
  }, []);
  return signedIn && Boolean(postId);
}
