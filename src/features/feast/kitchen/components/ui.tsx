"use client"

/* Small shared pieces for the Kitchen console. Colour via kitchen.css only. */

import { AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import type { Tone } from "../model/checklist"
import { kitchenMessage, toFailure, type ApiFailure } from "../model/errors"

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`kit-pill${tone === "neutral" ? "" : ` kit-pill--${tone}`}`}>{children}</span>
}

export type NoticeTone = "info" | "danger" | "success" | "warning"

export function Notice({ tone = "info", children }: { tone?: NoticeTone; children: ReactNode }) {
  const Icon = tone === "danger" || tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info
  return (
    <div className={`kit-notice${tone === "info" ? "" : ` kit-notice--${tone}`}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon size={14} aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function FailureNotice({ failure }: { failure: ApiFailure | null }) {
  if (!failure) return null
  return <Notice tone="danger">{kitchenMessage(failure)}</Notice>
}

export function Field({ label, hint, error, children, span }: { label: string; hint?: string; error?: string | null; children: ReactNode; span?: boolean }) {
  return (
    <label className={`kit-field${span ? " kit-span" : ""}`}>
      <span className="kit-label">{label}</span>
      {children}
      {error ? <span className="kit-error">{error}</span> : hint ? <span className="kit-hint">{hint}</span> : null}
    </label>
  )
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label className="kit-switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-checked={checked} />
      <span className="kit-switch__track" aria-hidden />
      <span>{label}</span>
    </label>
  )
}

/** Load one thing; `reload` refetches. Errors become ApiFailures. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [failure, setFailure] = useState<ApiFailure | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await run())
      setFailure(null)
    } catch (e) {
      setFailure(toFailure(e))
    } finally {
      setLoading(false)
    }
  }, [run])
  useEffect(() => {
    void reload()
  }, [reload])
  return { data, setData, failure, loading, reload }
}

/** Run one write at a time; expose its failure. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ApiFailure | null>(null)
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setFailure(null)
    try {
      return await fn()
    } catch (e) {
      setFailure(toFailure(e))
      return null
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, failure, setFailure, run }
}

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="kit-dialog" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`kit-dialog__panel${wide ? " kit-dialog__panel--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="kit-row kit-row--between" style={{ marginBottom: 12 }}>
          <h2 className="kit-card__title" style={{ margin: 0 }}>
            {title}
          </h2>
          <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.parse(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso)
  if (!Number.isFinite(ms)) return iso
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(ms)
}

export function formatTime(iso: string | null): string {
  if (!iso) return ""
  const ms = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"))
  if (!Number.isFinite(ms)) return ""
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(ms)
}
