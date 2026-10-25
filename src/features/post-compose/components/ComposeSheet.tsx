"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ComposeSheetProps {
  open: boolean
  title: string
  onClose: () => void
  /** A sheet opened from another sheet shows Back instead of Close. */
  onBack?: () => void
  children: ReactNode
  footer?: ReactNode
}

/*
  The composer's bottom sheet (a centred card on wide screens).

  A modal dialog: rendered into document.body so a transformed composer
  cannot trap its fixed position, focus moves into it on open and returns to
  the opener on close, Tab cycles inside it, and Escape closes it — without
  reaching the composer's own Escape handler, which would close the whole
  composer (the handler skips an event whose default was prevented).
*/
export function ComposeSheet({ open, title, onClose, onBack, children, footer }: ComposeSheetProps) {
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Latest handlers, so a parent re-render (a switch flipped inside the
  // sheet) does not re-run the open effect and pull focus back to the top.
  const handlers = useRef({ onClose, onBack })
  handlers.current = { onClose, onBack }

  useEffect(() => {
    if (!open || !mounted) return
    const previous = document.activeElement as HTMLElement | null
    const card = cardRef.current
    const first = card?.querySelector<HTMLElement>("[data-autofocus]") ?? card?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (!cardRef.current) return
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        const { onBack: back, onClose: close } = handlers.current
        ;(back ?? close)()
        return
      }
      if (e.key !== "Tab") return
      const items = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const i = items.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey && (i <= 0)) {
        e.preventDefault()
        items[items.length - 1].focus()
      } else if (!e.shiftKey && (i === -1 || i === items.length - 1)) {
        e.preventDefault()
        items[0].focus()
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      previous?.focus?.()
    }
  }, [open, mounted])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-brand-text/40 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      data-compose-sheet=""
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[24px] border border-brand-divider bg-brand-card text-brand-text shadow-2xl sm:rounded-[24px]"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-brand-divider px-4 py-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-brand-text hover:bg-brand-secondary"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-[16px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-brand-text hover:bg-brand-secondary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? <div className="shrink-0 border-t border-brand-divider px-4 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/** A full-width primary button for a sheet's footer. */
export function SheetDone({ label = "Done", onClick, disabled }: { label?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-40"
    >
      {label}
    </button>
  )
}

/** A labelled on/off row: the whole row is the switch. */
export function SwitchRow({
  title,
  detail,
  checked,
  onChange,
  name,
}: {
  title: string
  detail?: string
  checked: boolean
  onChange: (next: boolean) => void
  name: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-row={name}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-brand-secondary"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-brand-text">{title}</span>
        {detail ? <span className="mt-0.5 block text-[12px] leading-snug text-brand-text/60">{detail}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-brand-text/20"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-brand-card shadow-sm transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  )
}

/** A row that opens another sheet. */
export function LinkRow({ title, detail, onClick, name }: { title: string; detail: string; onClick: () => void; name: string }) {
  return (
    <button
      type="button"
      data-row={name}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-brand-secondary"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-brand-text">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-brand-text/60">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-brand-text/50" aria-hidden="true" />
    </button>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 pb-1 pt-4 text-[12px] font-semibold text-brand-text/55 first:pt-1">{children}</div>
}
