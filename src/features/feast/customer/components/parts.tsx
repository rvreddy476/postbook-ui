"use client"

/* Small shared pieces for the Feast customer screens. */

import { AlertCircle, Clock, Loader2, MapPinOff, PauseCircle } from "lucide-react"
import type { ReactNode } from "react"

import { formatPaise } from "../model/money"
import { formatNextOpening, type ServiceCard } from "../model/serviceability"
import { parseServerTime } from "../model/tracking"
import type { TaxesAndCharges, TotalsPaise } from "../model/wire"

export function StateBlock({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="fc-state" role="status">
      {icon ? <div className="fc-state__icon" aria-hidden="true">{icon}</div> : null}
      <p className="fc-state__title">{title}</p>
      {text ? <p className="fc-state__text">{text}</p> : null}
      {action}
    </div>
  )
}

export function Skel({ h = 16, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="fc-skel" style={{ height: h, width: w }} aria-hidden="true" />
}

export function Busy({ label }: { label: string }) {
  return (
    <span className="fc-row" role="status">
      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      {label}
    </span>
  )
}

export function VegMark({ foodType }: { foodType: string }) {
  const veg = foodType.toUpperCase() === "VEG" || foodType.toUpperCase() === "VEGAN"
  return <span className={veg ? "fc-veg" : "fc-veg is-nonveg"} role="img" aria-label={veg ? "Vegetarian" : "Non-vegetarian"} />
}

const CARD_ICONS = { out_of_range: MapPinOff, closed: Clock, not_accepting: PauseCircle, unavailable: AlertCircle } as const

/** The serviceability card: fixed heading, the server's message, and the next opening when known. */
export function ServiceCardView({ card }: { card: ServiceCard }) {
  if (card.kind === "open") return null
  const Icon = CARD_ICONS[card.kind]
  const opening = card.kind === "closed" ? formatNextOpening(card.nextOpensAt) : ""
  return (
    <div className={`fc-svc fc-svc--${card.kind}`} role="note">
      <Icon size={14} aria-hidden="true" />
      <span>
        <span className="fc-svc__title">{card.title}</span>
        <span>{capitalise(card.message)}</span>
        {opening ? <span className="fc-meta"> · {opening}</span> : null}
      </span>
    </div>
  )
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/**
  The bill exactly as the server priced it: the charges and the tax groups
  from `taxes_and_charges`, and `final_amount_paise` as the total. Nothing
  is added up here.
*/
export function Bill({ totals, breakdown }: { totals: TotalsPaise; breakdown: TaxesAndCharges | null }) {
  return (
    <div className="fc-stack">
      <dl className="fc-bill">
        <div className="fc-bill__row">
          <dt>Item total</dt>
          <dd>{formatPaise(totals.itemSubtotal)}</dd>
        </div>
        {totals.addonTotal ? (
          <div className="fc-bill__row">
            <dt>Add-ons</dt>
            <dd>{formatPaise(totals.addonTotal)}</dd>
          </div>
        ) : null}
        {breakdown ? (
          <>
            {breakdown.charges.map((c) => (
              <div className="fc-bill__row" key={`c-${c.kind}`}>
                <dt>{c.label}</dt>
                <dd>{formatPaise(c.amountPaise)}</dd>
              </div>
            ))}
            {breakdown.taxes.map((t, i) => (
              <div key={`t-${i}`}>
                <div className="fc-bill__row">
                  <dt>{t.label}</dt>
                  <dd>{formatPaise(t.taxPaise)}</dd>
                </div>
                {t.rates.map((r, j) => (
                  <div className="fc-bill__row fc-bill__row--sub" key={j}>
                    <dt>
                      {r.ratePercent}% on {formatPaise(r.taxablePaise)}
                      {r.igstPaise ? ` · IGST ${formatPaise(r.igstPaise)}` : ` · CGST ${formatPaise(r.cgstPaise)} + SGST ${formatPaise(r.sgstPaise)}`}
                    </dt>
                    <dd />
                  </div>
                ))}
              </div>
            ))}
          </>
        ) : (
          <>
            {totals.packagingFee ? <Row label="Packaging charges" paise={totals.packagingFee} /> : null}
            {totals.deliveryFee ? <Row label="Delivery fee" paise={totals.deliveryFee} /> : null}
            {totals.platformFee ? <Row label="Platform fee" paise={totals.platformFee} /> : null}
            <Row label="Taxes" paise={totals.taxTotal} />
          </>
        )}
        {totals.discountTotal ? (
          <div className="fc-bill__row">
            <dt>Discount</dt>
            <dd>−{formatPaise(totals.discountTotal)}</dd>
          </div>
        ) : null}
        <div className="fc-bill__row fc-bill__row--total">
          <dt>To pay</dt>
          <dd>{formatPaise(totals.finalAmount)}</dd>
        </div>
      </dl>
      {breakdown?.menuPricesTreatedAsExclusive ? <p className="fc-note">Menu prices are before GST; tax is added here.</p> : null}
      {breakdown?.needsAdviserConfirmation && breakdown.adviserNotice ? <p className="fc-note">{breakdown.adviserNotice}</p> : null}
    </div>
  )
}

function Row({ label, paise }: { label: string; paise: number }) {
  return (
    <div className="fc-bill__row">
      <dt>{label}</dt>
      <dd>{formatPaise(paise)}</dd>
    </div>
  )
}

/** A server time (RFC 3339 or Postgres text) as "13 Sept, 12:00 pm"; empty when unreadable. */
export function formatWhen(raw: string | null): string {
  const ms = parseServerTime(raw)
  if (ms === null) return ""
  const d = new Date(ms)
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
}
