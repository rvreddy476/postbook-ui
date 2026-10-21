"use client"

import { useEffect, useRef, useState } from "react"
import { Flag, X } from "lucide-react"

import { REPORT_REASONS, useSubmitReport, type ReportReason } from "@/hooks/useReport"

/*
  Report an account from its profile (parity T-03, web).
  POST /v1/reports { entity_type: "user", entity_id: <user id>, reason,
  details } through the shared useSubmitReport hook and reason list — the
  same trust-safety queue every other report reaches. The account is not
  told who reported it.
*/

interface ReportProfileDialogProps {
    open: boolean
    onClose: () => void
    userId: string
    username: string
}

export function ReportProfileDialog({ open, onClose, userId, username }: ReportProfileDialogProps) {
    const report = useSubmitReport()
    const [reason, setReason] = useState<ReportReason | "">("")
    const [details, setDetails] = useState("")
    const [done, setDone] = useState(false)
    const [already, setAlready] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)

    const { reset } = report
    useEffect(() => {
        if (!open) return
        setReason("")
        setDetails("")
        setDone(false)
        setAlready(false)
        reset()
    }, [open, reset])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", onKey)
        cardRef.current?.querySelector<HTMLElement>("input,button")?.focus()
        return () => document.removeEventListener("keydown", onKey)
    }, [open, onClose])

    if (!open) return null

    const submit = () => {
        if (!reason) return
        report.mutate(
            { targetType: "user", targetId: userId, reason, description: details.trim() },
            {
                onSuccess: () => setDone(true),
                onError: (err) => {
                    // 409: this viewer already has an open report on the account.
                    if ((err as { response?: { status?: number } })?.response?.status === 409) {
                        setAlready(true)
                        setDone(true)
                    }
                },
            },
        )
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center md:p-4"
            role="presentation"
            onClick={onClose}
        >
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-profile-title"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-t-2xl border border-brand-divider bg-brand-card p-5 text-brand-text shadow-2xl md:rounded-2xl"
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 id="report-profile-title" className="flex items-center gap-2 text-[15px] font-bold">
                        <Flag className="h-4 w-4 text-danger" aria-hidden />
                        {done ? "Report sent" : `Report @${username}`}
                    </h2>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        className="rounded-full p-1 hover:bg-brand-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </div>
                {done ? (
                    <>
                        <p className="text-[13px] text-muted-foreground">
                            {already
                                ? "You already have an open report on this account. Our team will review it."
                                : "Thanks. Our team reviews every report; the account is not told who sent it."}
                        </p>
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full bg-primary-ink px-4 py-2 text-[13px] font-semibold text-primary-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
                            >
                                Done
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <fieldset className="space-y-1">
                            <legend className="sr-only">Reason</legend>
                            {REPORT_REASONS.map((r) => (
                                <label
                                    key={r.value}
                                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[13px] hover:bg-brand-secondary"
                                >
                                    <input
                                        type="radio"
                                        name="profile-report-reason"
                                        value={r.value}
                                        checked={reason === r.value}
                                        onChange={() => setReason(r.value)}
                                        className="accent-[rgb(var(--theme-brand-accent))]"
                                    />
                                    {r.label}
                                </label>
                            ))}
                        </fieldset>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder="Anything else we should know? (optional)"
                            aria-label="Details"
                            maxLength={500}
                            rows={2}
                            className="mt-3 w-full resize-none rounded-lg border border-brand-divider bg-canvas px-3 py-2 text-[13px] outline-none focus:border-brand-accent"
                        />
                        {report.isError && !already ? (
                            <p role="alert" className="mt-2 text-[12px] text-danger">
                                Could not send the report. Try again.
                            </p>
                        ) : null}
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full px-4 py-2 text-[13px] font-semibold hover:bg-brand-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!reason || report.isPending}
                                onClick={submit}
                                className="rounded-full bg-danger px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
                            >
                                {report.isPending ? "Sending…" : "Send report"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
