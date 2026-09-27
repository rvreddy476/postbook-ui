"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

import { REPORT_REASONS } from "@/hooks/useReport";
import type { ChannelReportReason } from "../channelApi";
import { useReportChannel } from "../hooks/useChannel";

/*
  Report channel: the shared reason list (hooks/useReport), one choice,
  an optional note, then POST /v1/reports against the owner's account.
*/

export function ReportChannelDialog({ open, onClose, ownerId, channelName }: { open: boolean; onClose: () => void; ownerId: string; channelName: string }) {
  const report = useReportChannel();
  const [reason, setReason] = useState<ChannelReportReason | "">("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);

  const { reset } = report;
  // A fresh form each time it opens (only on open, not on every parent render).
  useEffect(() => {
    if (!open) return;
    setReason("");
    setDetails("");
    setDone(false);
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    if (!reason) return;
    report.mutate({ ownerId, reason, details: details.trim() }, { onSuccess: () => setDone(true) });
  };

  return (
    <div className="tube-chan-dialog" role="presentation" onClick={onClose}>
      <div className="tube-chan-dialog__card" role="dialog" aria-modal="true" aria-labelledby="tube-chan-report-title" onClick={(e) => e.stopPropagation()}>
        <div className="tube-chan-dialog__head">
          <h2 id="tube-chan-report-title" className="tube-chan-dialog__title">
            {done ? "Report sent" : `Report ${channelName}`}
          </h2>
          <button type="button" className="tube-chan-btn is-icon" aria-label="Close" onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>
        {done ? (
          <>
            <p className="tube-chan-dialog__body">Thanks. Our team reviews every report; the channel is not told who sent it.</p>
            <button type="button" className="tube-chan-btn is-primary is-wide" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <div role="radiogroup" aria-label="Reason" className="tube-chan-dialog__reasons">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={reason === r.value}
                  className="tube-chan-dialog__reason"
                  onClick={() => setReason(r.value)}
                >
                  <span>{r.label}</span>
                  {reason === r.value ? <Check aria-hidden /> : null}
                </button>
              ))}
            </div>
            <textarea
              className="tube-chan-dialog__note"
              rows={3}
              maxLength={500}
              placeholder="Anything we should know (optional)"
              aria-label="Details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            {report.isError ? <p className="tube-chan-dialog__error" role="alert">Could not send the report. Try again.</p> : null}
            <button type="button" className="tube-chan-btn is-primary is-wide" disabled={!reason || report.isPending} onClick={submit}>
              {report.isPending ? "Sending…" : "Send report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
