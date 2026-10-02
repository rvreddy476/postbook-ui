"use client"

/* Report and block, wherever a person is on screen. */

import { useState } from "react"
import { Ban, Flag } from "lucide-react"

import { Dialog } from "@/components/ui/dialog"
import { useGlobalToast } from "@/contexts/ToastContext"

import { useBlock, useReport } from "../hooks/safety"
import { datingErrorCopy } from "../model/errors"
import { REPORT_DETAILS_MAX, REPORT_REASONS, reportProblem } from "../model/safety"
import { Button, Confirm, Field, Notice } from "./kit"

/** The form alone: reasons from the server's fixed list; "Something else" needs a description. */
export function ReportForm({
  name,
  reason,
  details,
  error,
  busy,
  onReason,
  onDetails,
  onSubmit,
  onCancel,
}: {
  name: string
  reason: string
  details: string
  error: string
  busy: boolean
  onReason: (value: string) => void
  onDetails: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <form
      className="pulse-dialog"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <p className="pulse-dialog__body">Tell us what&apos;s wrong with {name}. They won&apos;t be told who reported them.</p>
      <Field id="pulse-report-reason" label="Reason">
        <select id="pulse-report-reason" className="pulse-input" value={reason} onChange={(e) => onReason(e.target.value)}>
          <option value="">Choose a reason</option>
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="pulse-report-details" label={reason === "other" ? "What happened? (required)" : "Anything to add? (optional)"} help={`${details.trim().length}/${REPORT_DETAILS_MAX}`}>
        <textarea id="pulse-report-details" className="pulse-input" rows={4} maxLength={REPORT_DETAILS_MAX} value={details} onChange={(e) => onDetails(e.target.value)} />
      </Field>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="pulse-dialog__actions">
        <Button variant="quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" type="submit" busy={busy}>
          Send report
        </Button>
      </div>
    </form>
  )
}

export function ReportDialog({ open, userId, name, onClose, onDone }: { open: boolean; userId: string; name: string; onClose: () => void; onDone?: (blocked: boolean) => void }) {
  const toast = useGlobalToast()
  const report = useReport()
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [error, setError] = useState("")

  const submit = () => {
    const input = { targetId: userId, reason, details }
    const problem = reportProblem(input)
    if (problem) {
      setError(problem)
      return
    }
    setError("")
    report.mutate(input, {
      onSuccess: (result) => {
        toast({ type: "success", title: "Report sent", description: result.blocked ? `Thanks. ${name} is now blocked too.` : "Thanks. Our team will review it." })
        setReason("")
        setDetails("")
        onClose()
        onDone?.(result.blocked)
      },
      onError: (e) => setError(datingErrorCopy(e)),
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Report ${name}`}>
      <ReportForm name={name} reason={reason} details={details} error={error} busy={report.isPending} onReason={setReason} onDetails={setDetails} onSubmit={submit} onCancel={onClose} />
    </Dialog>
  )
}

/** The two buttons, with their dialogs. `onGone` runs when the person is blocked (by either route). */
export function SafetyActions({ userId, name, onGone }: { userId: string; name: string; onGone?: () => void }) {
  const toast = useGlobalToast()
  const block = useBlock()
  const [reporting, setReporting] = useState(false)
  const [blocking, setBlocking] = useState(false)

  return (
    <div className="pulse-row">
      <Button variant="quiet" icon={Flag} onClick={() => setReporting(true)}>
        Report
      </Button>
      <Button variant="quiet" icon={Ban} onClick={() => setBlocking(true)}>
        Block
      </Button>
      <ReportDialog
        open={reporting}
        userId={userId}
        name={name}
        onClose={() => setReporting(false)}
        onDone={(blocked) => {
          if (blocked) onGone?.()
        }}
      />
      <Confirm
        open={blocking}
        title={`Block ${name}?`}
        body={<p>You won&apos;t see each other on Pulse, and any match between you ends. Unblocking later doesn&apos;t bring the match back.</p>}
        confirmLabel="Block"
        danger
        busy={block.isPending}
        onClose={() => setBlocking(false)}
        onConfirm={() =>
          block.mutate(userId, {
            onSuccess: () => {
              setBlocking(false)
              toast({ type: "success", title: `${name} is blocked` })
              onGone?.()
            },
            onError: (e) => {
              setBlocking(false)
              toast({ type: "error", title: datingErrorCopy(e) })
            },
          })
        }
      />
    </div>
  )
}
