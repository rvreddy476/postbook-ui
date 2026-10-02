"use client"

// The small presentational pieces every Pulse screen shares. Tokens only;
// the classes are in dating.css.

import Link from "next/link"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Loader2, Plane, type LucideIcon } from "lucide-react"

import { Dialog } from "@/components/ui/dialog"

import { travelMarker, type Person } from "../model/people"

export type Tone = "muted" | "info" | "success" | "warning" | "danger"

type Variant = "primary" | "secondary" | "quiet" | "danger"

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ")

export function Button({
  variant = "secondary",
  busy = false,
  icon: Icon,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; icon?: LucideIcon }) {
  return (
    <button type={type} className={cx("pulse-btn", `pulse-btn--${variant}`, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <Loader2 size={16} className="pulse-spin" aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  )
}

export function LinkButton({ href, variant = "secondary", icon: Icon, children, className }: { href: string; variant?: Variant; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("pulse-btn", `pulse-btn--${variant}`, className)}>
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span>{children}</span>
    </Link>
  )
}

export function Notice({ tone = "info", children, role }: { tone?: Tone; children: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role ?? (tone === "danger" ? "alert" : "status")} className={cx("pulse-notice", `pulse-tone--${tone}`)}>
      {children}
    </div>
  )
}

export function Pill({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("pulse-pill", `pulse-tone--${tone}`)}>{children}</span>
}

/** Travel mode (M8): "Visiting Hyderabad" on anyone who is on a trip; nothing otherwise. */
export function TravelPill({ person }: { person: Pick<Person, "travelling" | "city"> }) {
  const text = travelMarker(person)
  if (!text) return null
  return (
    <span className="pulse-pill pulse-tone--info pulse-travel">
      <Plane size={12} aria-hidden="true" />
      <span>{text}</span>
    </span>
  )
}

export function Panel({ title, sub, children, actions }: { title?: string; sub?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="pulse-panel">
      {title ? (
        <div className="pulse-panel__head">
          <div>
            <h2 className="pulse-panel__title">{title}</h2>
            {sub ? <p className="pulse-panel__sub">{sub}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function PageHead({ title, sub, back }: { title: string; sub?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="pulse-head">
      {back ? (
        <Link href={back.href} className="pulse-head__back">
          ← {back.label}
        </Link>
      ) : null}
      <h1 className="pulse-head__title">{title}</h1>
      {sub ? <p className="pulse-head__sub">{sub}</p> : null}
    </header>
  )
}

export function Field({ id, label, help, error, children }: { id: string; label: string; help?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="pulse-field">
      <label htmlFor={id} className="pulse-field__label">
        {label}
      </label>
      {children}
      {help ? <p className="pulse-field__help">{help}</p> : null}
      {error ? (
        <p className="pulse-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** A set of one-of choices drawn as pills; a real radio group underneath. */
export function Choices({
  name,
  legend,
  options,
  value,
  onChange,
  multiple = false,
  disabled = false,
  isDisabled,
  help,
  error,
}: {
  name: string
  legend: string
  options: readonly { value: string; label: string }[]
  value: string | string[]
  onChange: (value: string) => void
  multiple?: boolean
  /** The whole group. */
  disabled?: boolean
  /** One choice, e.g. an unpicked one once a limit is reached. */
  isDisabled?: (value: string) => boolean
  help?: ReactNode
  error?: string
}) {
  const selected = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v)
  return (
    <fieldset className="pulse-choices" disabled={disabled || undefined}>
      <legend className="pulse-field__label">{legend}</legend>
      {help ? <p className="pulse-field__help">{help}</p> : null}
      <div className="pulse-choices__row">
        {options.map((o) => {
          const off = isDisabled?.(o.value) ?? false
          return (
            <label key={o.value} className={cx("pulse-choice", selected(o.value) && "is-selected", off && "is-disabled")}>
              <input type={multiple ? "checkbox" : "radio"} name={name} value={o.value} checked={selected(o.value)} disabled={off || undefined} onChange={() => onChange(o.value)} />
              <span>{o.label}</span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p className="pulse-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

export function Toggle({ id, label, help, checked, disabled, onChange }: { id: string; label: string; help?: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="pulse-toggle">
      <div>
        <label htmlFor={id} className="pulse-toggle__label">
          {label}
        </label>
        {help ? <p className="pulse-field__help">{help}</p> : null}
      </div>
      <input id={id} type="checkbox" role="switch" className="pulse-switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="pulse-loading" role="status" aria-live="polite">
      <Loader2 size={22} className="pulse-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function StatePanel({ icon: Icon, title, body, children, tone = "muted" }: { icon?: LucideIcon; title: string; body?: ReactNode; children?: ReactNode; tone?: Tone }) {
  return (
    <div className="pulse-state">
      {Icon ? (
        <span className={cx("pulse-state__icon", `pulse-tone--${tone}`)} aria-hidden="true">
          <Icon size={24} />
        </span>
      ) : null}
      <h2 className="pulse-state__title">{title}</h2>
      {body ? <p className="pulse-state__body">{body}</p> : null}
      {children ? <div className="pulse-state__actions">{children}</div> : null}
    </div>
  )
}

export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="pulse-dialog">
        <div className="pulse-dialog__body">{body}</div>
        <div className="pulse-dialog__actions">
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
