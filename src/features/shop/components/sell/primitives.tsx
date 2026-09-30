"use client"

// The small presentational pieces every MSeller screen shares. Tokens only;
// the classes are in shop.css under `/* == W3 seller == */`.

import { forwardRef, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { BannerTone } from "../../model/sell"

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="shop-sell-head">
      <div>
        <h1 className="shop-sell-head__title">{title}</h1>
        {sub ? <p className="shop-sell-head__sub">{sub}</p> : null}
      </div>
      {actions ? <div className="shop-sell-head__actions">{actions}</div> : null}
    </div>
  )
}

export function Panel({ children, className, title, sub }: { children: ReactNode; className?: string; title?: string; sub?: ReactNode }) {
  return (
    <section className={cn("shop-sell-panel", className)}>
      {title ? (
        <div className="shop-sell-panel__head">
          <h2 className="shop-sell-panel__title">{title}</h2>
          {sub ? <p className="shop-sell-panel__sub">{sub}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export const TONE_CLASS: Record<BannerTone, string> = {
  muted: "shop-sell-tone--muted",
  info: "shop-sell-tone--info",
  warning: "shop-sell-tone--warning",
  success: "shop-sell-tone--success",
  danger: "shop-sell-tone--danger",
}

export function Pill({ tone, children }: { tone: BannerTone; children: ReactNode }) {
  return <span className={cn("shop-sell-pill", TONE_CLASS[tone])}>{children}</span>
}

export function Notice({ tone, children, role }: { tone: BannerTone; children: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role ?? (tone === "danger" ? "alert" : "status")} className={cn("shop-sell-notice", TONE_CLASS[tone])}>
      {children}
    </div>
  )
}

export function Field({
  id,
  label,
  error,
  help,
  required,
  children,
}: {
  id: string
  label: string
  error?: string | null
  help?: string | null
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="shop-sell-field">
      <label htmlFor={id} className="shop-sell-field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="shop-sell-field__error" role="alert">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="shop-sell-field__help">
          {help}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  required,
  type = "text",
  inputMode,
  placeholder,
  maxLength,
  autoComplete,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  error?: string | null
  help?: string | null
  required?: boolean
  type?: string
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel"
  placeholder?: string
  maxLength?: number
  autoComplete?: string
  disabled?: boolean
}) {
  return (
    <Field id={id} label={label} error={error} help={help} required={required}>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("shop-sell-select", className)} {...props} />
))
Select.displayName = "SellSelect"

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("shop-sell-textarea", className)} {...props} />
))
Textarea.displayName = "SellTextarea"

export function EmptyState({ text, action }: { text: string; action?: { label: string; href: string } | { label: string; onClick: () => void } }) {
  return (
    <div className="shop-sell-empty">
      <p>{text}</p>
      {action ? (
        "href" in action ? (
          <Link href={action.href} className="shop-sell-link">
            {action.label}
          </Link>
        ) : (
          <button type="button" className="shop-sell-link" onClick={action.onClick}>
            {action.label}
          </button>
        )
      ) : null}
    </div>
  )
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="shop-sell-empty" role="alert">
      <p>{text}</p>
      {onRetry ? (
        <button type="button" className="shop-sell-link" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="shop-sell-skeleton" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function StepRail<T extends string>({
  steps,
  labels,
  current,
  done,
  unlocked,
  onPick,
}: {
  steps: readonly T[]
  labels: Record<T, string>
  current: T
  done: ReadonlySet<T>
  unlocked: (step: T) => boolean
  onPick: (step: T) => void
}) {
  return (
    <ol className="shop-sell-steps" aria-label="Steps">
      {steps.map((step, i) => {
        const open = unlocked(step)
        return (
          <li key={step} className={cn("shop-sell-steps__item", step === current && "is-current", done.has(step) && "is-done", !open && "is-locked")}>
            <button type="button" className="shop-sell-steps__btn" disabled={!open} aria-current={step === current ? "step" : undefined} onClick={() => onPick(step)}>
              <span className="shop-sell-steps__n" aria-hidden="true">
                {i + 1}
              </span>
              <span>{labels[step]}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
