"use client"

/* Small shared pieces for the Doorstep customer screens. */

import {
  AirVent,
  Bug,
  Camera,
  Car,
  CircleAlert,
  Dumbbell,
  Flower2,
  Hammer,
  HardHat,
  House,
  Loader2,
  PaintRoller,
  PlugZap,
  Scissors,
  SprayCan,
  Truck,
  UsersRound,
  WashingMachine,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import api from "@/lib/api"

import { toDoorstepError } from "../api/client"
import { statusLabel, statusTone } from "../model/booking"
import { formatPaise, formatRateBps, percentOff } from "../model/money"
import { fromPriceLabel, unitWord } from "../model/professionals"
import { isNotOpen, refusalLine } from "../model/refusals"
import type { BookingStatus, Family, Outstanding, QuoteLine } from "../model/wire"

export function StateBlock({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="ds-state" role="status">
      {icon ? (
        <div className="ds-state__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="ds-state__title">{title}</p>
      {text ? <p className="ds-state__text">{text}</p> : null}
      {action}
    </div>
  )
}

/** The error state for a failed read, with the pilot gate said plainly. */
export function ErrorState({ error, what, onRetry }: { error: unknown; what: string; onRetry?: () => void }) {
  const e = toDoorstepError(error)
  return (
    <StateBlock
      icon={isNotOpen(e) ? <House size={22} /> : <CircleAlert size={22} />}
      title={isNotOpen(e) ? "Doorstep is in a small pilot" : `${what} couldn't be loaded`}
      text={refusalLine(e)}
      action={
        onRetry && !isNotOpen(e) ? (
          <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" onClick={onRetry}>
            Try again
          </button>
        ) : null
      }
    />
  )
}

export function Skel({ h = 16, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="ds-skel" style={{ height: h, width: w }} aria-hidden="true" />
}

export function Busy({ label }: { label: string }) {
  return (
    <span className="ds-row" role="status">
      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      {label}
    </span>
  )
}

/* ── categories ───────────────────────────────────────────────────── */

const SLUG_ICONS: Record<string, LucideIcon> = {
  "ac-service-repair": AirVent,
  "appliance-ro-repair": WashingMachine,
  carpenter: Hammer,
  electrician: PlugZap,
  "home-cleaning": SprayCan,
  painting: PaintRoller,
  "pest-control": Bug,
  plumber: Wrench,
  "salon-men": Scissors,
  "salon-women": Flower2,
}

const FAMILY_ICONS: Record<Family, LucideIcon> = {
  APPLIANCE_REPAIR: WashingMachine,
  BEAUTY_SALON: Scissors,
  HOME_CLEANING: SprayCan,
  INSTALLATION_REPAIR: Wrench,
  PAINTING: PaintRoller,
  PEST_CONTROL: Bug,
  CAR_CARE: Car,
  HOME_STAFFING: UsersRound,
  RELOCATION: Truck,
  PHOTOGRAPHY: Camera,
  FITNESS_WELLNESS: Dumbbell,
  CONSTRUCTION: HardHat,
}

export function categoryIcon(slug: string, family: Family): LucideIcon {
  return SLUG_ICONS[slug] ?? FAMILY_ICONS[family] ?? House
}

/* ── money ────────────────────────────────────────────────────────── */

export function PriceTag({ price, mrp, from }: { price: number; mrp: number | null; from?: boolean }) {
  const off = percentOff(price, mrp)
  return (
    <span>
      {from ? <span className="ds-meta">From </span> : null}
      <span className="ds-price">{formatPaise(price)}</span>
      {off !== null && mrp !== null ? (
        <>
          <span className="ds-strike">{formatPaise(mrp)}</span>
          <span className="ds-off">{off}% off</span>
        </>
      ) : null}
    </span>
  )
}

/**
  B1: "From ₹699 per hour" — the lowest approved professional price — or a
  plain "No professional yet" while nobody prices it. Never the city's
  suggested price (it is never charged).
*/
export function FromPrice({ paise, unit, mrp = null }: { paise: number | null; unit?: string; mrp?: number | null }) {
  const label = fromPriceLabel(paise, unit)
  if (label === null || paise === null) return <span className="ds-meta">No professional yet</span>
  const off = percentOff(paise, mrp)
  return (
    <span>
      <span className="ds-price">{label}</span>
      {off !== null && mrp !== null ? (
        <>
          <span className="ds-strike">{formatPaise(mrp)}</span>
          <span className="ds-off">{off}% off</span>
        </>
      ) : null}
    </span>
  )
}

/** The quote's lines and totals exactly as the server priced them. Nothing is added up here. */
export function QuoteBill({ lines, totalPaise, taxablePaise, taxPaise, note, provisional }: { lines: QuoteLine[]; totalPaise: number; taxablePaise: number; taxPaise: number; note?: string; provisional?: boolean }) {
  const rates = [...new Set(lines.map((l) => l.taxRateBps))]
  return (
    <div className="ds-stack" style={{ gap: 8 }}>
      <dl className="ds-bill">
        {lines.map((l) => (
          <div className="ds-bill__row" key={`${l.kind}-${l.refId}`}>
            <dt>
              {l.quantity > 1 || l.unit !== "per_job" ? `${l.quantity} × ` : ""}
              {l.name}
              {l.unit !== "per_job" && unitWord(l.unit) ? ` (${formatPaise(l.unitPricePaise)} ${unitWord(l.unit)})` : ""}
            </dt>
            <dd>{formatPaise(l.lineTotalPaise)}</dd>
          </div>
        ))}
        <div className="ds-bill__row ds-bill__row--sub">
          <dt>Price before GST</dt>
          <dd>{formatPaise(taxablePaise)}</dd>
        </div>
        <div className="ds-bill__row ds-bill__row--sub">
          <dt>GST{rates.length === 1 ? ` at ${formatRateBps(rates[0])}` : ""} (included)</dt>
          <dd>{formatPaise(taxPaise)}</dd>
        </div>
        <div className="ds-bill__row ds-bill__row--total">
          <dt>Total</dt>
          <dd>{formatPaise(totalPaise)}</dd>
        </div>
      </dl>
      {provisional && note ? <p className="ds-note">{note}</p> : null}
    </div>
  )
}

/* ── status ───────────────────────────────────────────────────────── */

export function StatusTag({ status }: { status: BookingStatus }) {
  const tone = statusTone(status)
  return <span className={tone === "neutral" ? "ds-tag" : `ds-tag ds-tag--${tone}`}>{statusLabel(status)}</span>
}

/* ── dues ─────────────────────────────────────────────────────────── */

/** The outstanding-dues banner. While it shows, new bookings are blocked. */
export function DuesBanner({ outstanding }: { outstanding: Outstanding | undefined }) {
  if (!outstanding || outstanding.totalPaise <= 0) return null
  return (
    <div className="ds-dues" role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <span className="ds-grow">
        <strong>{formatPaise(outstanding.totalPaise)} unpaid</strong>
        <span className="ds-meta" style={{ display: "block" }}>
          Extras from an earlier visit are due. Pay them to book again.
        </span>
      </span>
      <Link href="/doorstep/outstanding" className="ds-btn ds-btn--primary ds-btn--sm">
        Pay dues
      </Link>
    </div>
  )
}

/* ── media ────────────────────────────────────────────────────────── */

/** media-service's serve route, through the API base ("" = same-origin proxy). */
export function mediaServeUrl(mediaId: string): string {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${encodeURIComponent(mediaId)}/serve`
}

/** Private visit images require the same authenticated request as the booking. */
export function VisitImg({ bookingId, mediaId, alt, className }: { bookingId: string; mediaId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null
    setUrl(null)
    void api.get(`/v1/doorstep/bookings/${encodeURIComponent(bookingId)}/photos/${encodeURIComponent(mediaId)}`, { responseType: "blob", signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(data); setUrl(objectUrl) } })
      .catch(() => { /* An inaccessible image stays a placeholder, never falls back to public media. */ })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [bookingId, mediaId])
  return url ? <img src={url} alt={alt} className={className} /> : <span className={className} role="img" aria-label={`${alt} — unavailable`} />
}

export function MediaImg({ mediaId, alt, className }: { mediaId: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaServeUrl(mediaId)} alt={alt} className={className} loading="lazy" />
}

/* ── a simple dialog sheet ────────────────────────────────────────── */

export function Sheet({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>("button, input, textarea, select")?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      previous?.focus()
    }
  }, [onClose])
  return (
    <div className="ds-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="ds-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ds-sheet__head">
          <h2 className="ds-h2 ds-grow">{title}</h2>
          <button type="button" className="ds-back" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="ds-sheet__body">{children}</div>
        {foot ? <div className="ds-sheet__foot">{foot}</div> : null}
      </div>
    </div>
  )
}
