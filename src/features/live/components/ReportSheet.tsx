"use client"

import { useState } from "react"

import { Dialog } from "@/components/ui/dialog"
import { useReportLive } from "@/hooks/useLiveV2"
import { useGlobalToast } from "@/contexts/ToastContext"
import { REPORT_NOTE_MAX, REPORT_REASONS, reportBody, reportErrorCopy, type LiveReportReason } from "../report"

/**
 * Viewer Report sheet for the stream or one chat message.
 * POST /v1/livestream/streams/:id/reports {reason, message_id?, note?}
 */
export function ReportSheet({
  open,
  onClose,
  streamId,
  messageId,
}: {
  open: boolean
  onClose: () => void
  streamId: string
  messageId?: string | null
}) {
  const report = useReportLive(streamId)
  const toast = useGlobalToast()
  const [reason, setReason] = useState<LiveReportReason | "">("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setReason("")
    setNote("")
    setError(null)
    onClose()
  }

  const submit = async () => {
    const body = reportBody({ reason, messageId, note })
    if (!body) {
      setError("Choose a reason.")
      return
    }
    setError(null)
    try {
      await report.mutateAsync(body)
      toast({ type: "success", title: "Thanks. We'll take a look." })
      close()
    } catch (err) {
      setError(reportErrorCopy(err))
    }
  }

  return (
    <Dialog open={open} onClose={close} title={messageId ? "Report message" : "Report stream"}>
      <div className="space-y-4">
        <div className="live-choices" role="radiogroup" aria-label="Reason">
          {REPORT_REASONS.map((r) => (
            <label key={r.value} className="live-choice" data-active={reason === r.value}>
              <input
                type="radio"
                name="live-report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
        <div>
          <label className="live-label" htmlFor="live-report-note">Anything else? (optional)</label>
          <textarea
            id="live-report-note"
            className="live-textarea"
            value={note}
            maxLength={REPORT_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && <div className="live-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="live-btn live-btn--ghost" onClick={close}>Cancel</button>
          <button
            type="button"
            className="live-btn live-btn--primary"
            onClick={submit}
            disabled={!reason || report.isPending}
          >
            {report.isPending ? "Sending…" : "Send report"}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
