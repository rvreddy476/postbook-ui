"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flag, X } from "lucide-react";

import { REPORT_REASONS, useSubmitReport } from "@/hooks/useReport";
import { useGlobalToast } from "@/contexts/ToastContext";

interface ReelReportDialogProps {
  open: boolean;
  reelId: string;
  onClose: () => void;
}

export function ReelReportDialog({ open, reelId, onClose }: ReelReportDialogProps) {
  const toast = useGlobalToast();
  const report = useSubmitReport();
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"] | "">("");
  const [details, setDetails] = useState("");

  const close = () => {
    setReason("");
    setDetails("");
    onClose();
  };

  const submit = async () => {
    if (!reason) return;
    try {
      await report.mutateAsync({ targetType: "reel", targetId: reelId, reason, description: details });
      toast({ type: "success", title: "Report sent", description: "Thanks — our team will review it." });
      close();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast({
        type: status === 409 ? "info" : "error",
        title: status === 409 ? "Already reported" : "Could not send the report",
        description: status === 409 ? "You have an open report on this reel." : "Please try again.",
      });
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Report reel"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl border border-border bg-brand-card p-5 text-brand-text shadow-2xl md:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <Flag className="h-4 w-4 text-danger" /> Report this reel
              </h2>
              <button type="button" aria-label="Close" onClick={close} className="rounded-full p-1 hover:bg-brand-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[13px] hover:bg-brand-secondary">
                  <input type="radio" name="reel-report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[rgb(var(--theme-brand-accent))]" />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything else we should know? (optional)"
              rows={2}
              className="mt-3 w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] outline-none focus:border-brand-accent"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-full px-4 py-2 text-[13px] font-semibold hover:bg-brand-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason || report.isPending}
                onClick={submit}
                className="rounded-full bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {report.isPending ? "Sending…" : "Send report"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
