'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';

import { forwardSummary } from '@/lib/chat/forward';
import { forwardToChats } from '@/services/chatParityApi';
import { ChatTargetPicker, type ChatTarget } from '../ChatTargetPicker';
import { forwardToTargets, newIdempotencyKey } from '../shareToChats';
import { PickerSheetShell } from './PickerSheetShell';

/*
  Forward a message to up to five chats (CONTRACT §2.4). People without a
  chat get one opened first; then one forward call covers every chat. When
  every chat got it, onDone hands the line back to the thread; otherwise the
  sheet stays open with the line, and only the chats that missed out stay
  picked so Send retries them.
*/
export function ForwardSheet({
  sourceConversationId,
  message,
  onClose,
  onDone,
}: {
  sourceConversationId: string;
  message: { id: string; text?: string; type?: string };
  onClose(): void;
  onDone(summary: string): void;
}) {
  const [selected, setSelected] = useState<ChatTarget[]>([]);
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const send = async () => {
    if (sending || selected.length === 0) return;
    setSending(true);
    setSummary(null);
    try {
      const run = await forwardToTargets(sourceConversationId, message, selected, newIdempotencyKey(), { forward: forwardToChats });
      const s = forwardSummary(run.results, run.nameOf);
      if (s.failed === 0 && s.sent > 0) {
        onDone(s.text);
        return;
      }
      setSummary(s.text);
      const failed = new Set(run.failedTargets.map((t) => t.key));
      setSelected((cur) => cur.filter((t) => failed.has(t.key)));
    } catch {
      setSummary("Couldn't forward the message. Try again.");
    } finally {
      setSending(false);
    }
  };

  const count = selected.length;

  return (
    <PickerSheetShell
      title="Forward"
      onClose={onClose}
      busy={sending}
      footer={
        <div className="flex flex-col gap-2">
          {summary && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger" role="alert">
              {summary}
            </p>
          )}
          <button
            type="button"
            onClick={() => void send()}
            disabled={count === 0 || sending}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors ${
              count > 0 && !sending ? 'bg-send text-white hover:bg-send-hover' : 'bg-brand-secondary text-brand-text/40'
            }`}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
            {sending ? 'Sending' : count > 1 ? `Send to ${count}` : 'Send'}
          </button>
        </div>
      }
    >
      <div className="flex h-[24rem] max-h-[60vh] min-h-0 flex-col">
        <ChatTargetPicker selected={selected} onChange={setSelected} excludeConversationIds={[sourceConversationId]} />
      </div>
    </PickerSheetShell>
  );
}

export default ForwardSheet;
