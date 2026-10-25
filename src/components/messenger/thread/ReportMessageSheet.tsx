'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { MESSAGE_REPORT_REASONS, reportMessage, type MessageReportReason } from '@/services/chatParityApi';
import { PickerSheetShell } from './PickerSheetShell';
import { REPORT_NOTE_MAX, REPORT_REASON_LABELS, reportNote } from './pickerSheetModels';

/*
  Report one message (CONTRACT §2.6): a reason, an optional note, Submit.
  The server forwards it to trust and safety with a snapshot of the message.
  A server without the route yet says so in plain words instead of failing.
*/
export function ReportMessageSheet({
  conversationId,
  messageId,
  onClose,
  onDone,
}: {
  conversationId: string;
  messageId: string;
  onClose(): void;
  onDone(text: string): void;
}) {
  const [reason, setReason] = useState<MessageReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      const ok = await reportMessage(conversationId, messageId, reason, reportNote(note));
      if (ok === null) {
        setError("Reporting messages isn't available yet.");
        return;
      }
      onDone("Thanks. We'll review this message.");
    } catch {
      setError("Couldn't send the report. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <PickerSheetShell
      title="Report message"
      onClose={onClose}
      busy={sending}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!reason || sending}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors ${
              reason && !sending ? 'bg-danger text-white' : 'bg-brand-secondary text-brand-text/40'
            }`}
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Submit
          </button>
        </div>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <p className="pb-2 text-[12px] text-brand-text/60">Why are you reporting this message? The sender won&rsquo;t know it was you.</p>
        <div role="radiogroup" aria-label="Reason" className="flex flex-col">
          {MESSAGE_REPORT_REASONS.map((r) => {
            const on = reason === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setReason(r)}
                className="flex items-center justify-between rounded-xl px-2 py-2.5 text-left text-[13px] text-brand-text transition-colors hover:bg-brand-secondary"
              >
                {REPORT_REASON_LABELS[r]}
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${on ? 'border-primary-ink' : 'border-brand-divider'}`}
                  aria-hidden
                >
                  {on && <span className="h-2 w-2 rounded-full bg-primary-ink" />}
                </span>
              </button>
            );
          })}
        </div>
        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-brand-text">Add details (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, REPORT_NOTE_MAX))}
            maxLength={REPORT_NOTE_MAX}
            rows={3}
            disabled={sending}
            placeholder="Anything that helps us understand"
            className="mt-1 w-full resize-none rounded-xl bg-brand-secondary px-3 py-2 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40"
          />
          <span className="block text-right text-[11px] text-brand-text/60">
            {note.length}/{REPORT_NOTE_MAX}
          </span>
        </label>
      </div>
    </PickerSheetShell>
  );
}

export default ReportMessageSheet;
