"use client"

// Shared bits for Mopedu admin pages — status pills, formatters, error helpers.
// Kept colocated under `app/admin/mopedu/_shared` (the underscore opts it out
// of being treated as a route segment by Next.js).

import * as React from "react"

export function classNames(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ")
}

export function maskPhone(phone: string | undefined): string {
  if (!phone) return "—"
  const digits = phone.replace(/\D/g, "")
  if (digits.length <= 4) return "••••" + digits
  return "••••" + digits.slice(-4)
}

export function maskDocNumber(value?: string): string {
  if (!value) return "—"
  if (value.length <= 4) return "••••"
  return "••••" + value.slice(-4)
}

export function paiseToRupees(paise: number | undefined | null): string {
  if (typeof paise !== "number" || Number.isNaN(paise)) return "—"
  const rupees = paise / 100
  return rupees.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  })
}

export function formatDate(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

export function relativeTime(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  const diff = Date.now() - d.getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

export function errorMessage(err: unknown): string {
  if (!err) return ""
  if (err instanceof Error && err.message) return err.message
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { error?: { message?: string } } } })
      .response?.data?.error?.message === "string"
  ) {
    return (
      err as { response: { data: { error: { message: string } } } }
    ).response.data.error.message
  }
  return "Request failed."
}

export type PillTone =
  | "neutral"
  | "amber"
  | "green"
  | "red"
  | "blue"
  | "violet"
  | "slate"

const PILL_TONES: Record<PillTone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-rose-100 text-rose-800",
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  slate: "bg-slate-100 text-slate-700",
}

export function StatusPill({
  status,
  tone,
  label,
}: {
  status: string
  tone?: PillTone
  label?: string
}) {
  const resolved: PillTone = tone ?? toneForStatus(status)
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        PILL_TONES[resolved],
      )}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  )
}

export function toneForStatus(status: string): PillTone {
  switch (status) {
    case "approved":
    case "verified":
    case "completed":
      return "green"
    case "pending":
    case "submitted":
    case "under_review":
      return "amber"
    case "rejected":
    case "blocked":
    case "failed":
    case "expired":
      return "red"
    case "suspended":
      return "slate"
    case "in_progress":
    case "partner_assigned":
    case "partner_arrived":
    case "searching":
    case "requested":
      return "blue"
    case "not_submitted":
      return "neutral"
    default:
      return "neutral"
  }
}

// Generic side panel + reason sheet helpers used by docs/vehicles/payments
// queues. Keeping them here keeps the page files focused.

export function ReasonInput({
  value,
  onChange,
  placeholder = "Reason (required)",
  maxLength = 200,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
      />
      <p className="mt-1 text-right text-[11px] text-gray-500">
        {value.length}/{maxLength}
      </p>
    </div>
  )
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "green",
  type = "button",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: "green" | "red" | "amber" | "slate" | "blue"
  type?: "button" | "submit"
}) {
  const tones: Record<typeof tone, string> = {
    green: "bg-emerald-600 hover:bg-emerald-700 text-white",
    red: "bg-rose-600 hover:bg-rose-700 text-white",
    amber: "bg-amber-500 hover:bg-amber-600 text-white",
    slate: "bg-slate-700 hover:bg-slate-800 text-white",
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
      )}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: "button" | "submit"
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function EmptyState({
  title,
  body,
}: {
  title: string
  body?: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {body ? <p className="mt-1 text-xs text-gray-500">{body}</p> : null}
    </div>
  )
}

// ── First-name masking (for live rides + complaints) ──────────────────────

export function maskFirstName(fullName: string | undefined): string {
  if (!fullName) return "—"
  const trimmed = fullName.trim()
  if (!trimmed) return "—"
  const first = trimmed.split(/\s+/)[0]
  return first
}

// ── Severity pill (safety incidents) ──────────────────────────────────────

export function severityTone(
  severity: "critical" | "high" | "medium" | "low" | string,
): PillTone {
  switch (severity) {
    case "critical":
      return "red"
    case "high":
      return "amber"
    case "medium":
      return "amber"
    case "low":
      return "blue"
    default:
      return "neutral"
  }
}

// ── Modal — generic centred dialog ────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "lg",
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: "sm" | "md" | "lg" | "xl"
}) {
  if (!open) return null
  const widths: Record<typeof width, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className={classNames(
          "w-full rounded-2xl bg-white shadow-xl",
          widths[width],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <p className="text-sm font-bold text-brand-text">{title}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-brand-text/40 hover:bg-gray-100 hover:text-brand-text"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ── ConfirmDialog — used for ride cancel ──────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "red",
  reasonRequired = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: "red" | "amber" | "green" | "blue"
  reasonRequired?: boolean
  pending?: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = React.useState("")
  React.useEffect(() => {
    if (open) setReason("")
  }, [open])
  const canConfirm = reasonRequired ? reason.trim().length > 0 : true
  return (
    <Modal open={open} onClose={onClose} title={title} width="md">
      {description ? (
        <p className="text-sm text-brand-text/70">{description}</p>
      ) : null}
      {reasonRequired ? (
        <div className="mt-3">
          <ReasonInput value={reason} onChange={setReason} />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <SecondaryButton onClick={onClose} disabled={pending}>
          {cancelLabel}
        </SecondaryButton>
        <PrimaryButton
          tone={tone}
          disabled={!canConfirm || pending}
          onClick={() => onConfirm(reason.trim())}
        >
          {confirmLabel}
        </PrimaryButton>
      </div>
    </Modal>
  )
}

// ── JSON viewer (audit logs, status history bodies) ───────────────────────

export function JsonViewer({
  value,
  collapsedHeight = "max-h-96",
}: {
  value: unknown
  collapsedHeight?: string
}) {
  const text = React.useMemo(() => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [value])
  return (
    <pre
      className={classNames(
        "overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100",
        collapsedHeight,
      )}
    >
      {text || "—"}
    </pre>
  )
}

// ── Map placeholder (live rides — real map in a later sprint) ─────────────

export function MapPlaceholder({
  title = "Map view",
  body = "Sprint 4 — see the live list below.",
}: {
  title?: string
  body?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-6 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(16,185,129,0.18),transparent_60%)]"
      />
      <p className="relative text-sm font-semibold text-brand-text">{title}</p>
      <p className="relative mt-1 text-xs text-brand-text/60">{body}</p>
    </div>
  )
}

// ── Status timeline (live ride detail + ride history detail) ──────────────

export function StatusTimeline({
  events,
}: {
  events: Array<{ status: string; at: string; note?: string }>
}) {
  if (!events || events.length === 0) {
    return (
      <p className="text-xs text-brand-text/55">No status history recorded.</p>
    )
  }
  return (
    <ol className="relative space-y-3 border-l border-gray-200 pl-4">
      {events.map((ev, i) => (
        <li key={`${ev.status}-${ev.at}-${i}`} className="relative">
          <span
            aria-hidden
            className="absolute -left-[18px] mt-1 h-2 w-2 rounded-full bg-brand-text"
          />
          <div className="flex items-center gap-2">
            <StatusPill status={ev.status} />
            <span className="text-[11px] text-brand-text/55">
              {formatDate(ev.at)}
            </span>
          </div>
          {ev.note ? (
            <p className="mt-1 text-xs text-brand-text/70">{ev.note}</p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

// ── Pagination — shared across rides + audit ──────────────────────────────

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number
  limit: number
  offset: number
  onChange: (nextOffset: number) => void
}) {
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + limit, total)
  const canPrev = offset > 0
  const canNext = offset + limit < total
  return (
    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-brand-text/60">
      <span>
        {start}–{end} of {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 font-semibold text-brand-text/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onChange(offset + limit)}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 font-semibold text-brand-text/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ── Truncation helpers ────────────────────────────────────────────────────

export function shortId(id: string | undefined, n = 8): string {
  if (!id) return "—"
  return id.length <= n ? id : id.slice(0, n)
}
