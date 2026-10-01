"use client"

/*
  The presentational pieces of the checkout screen: props in, callbacks
  out. The rules they draw (what is selectable, what the totals are, when
  the price expires) are decided in model/checkout.ts.
*/

import { Clock, MapPin, Plus, Truck } from "lucide-react"
import Link from "next/link"

import { Skeleton } from "@/components/ui/skeleton"
import { inrMinor } from "@/features/shop/money"

import { ADDRESS_TYPE_LABELS } from "../../model/addresses"
import { discountRow } from "../../model/coupons"
import { arrivesByLine } from "../../model/delivery"
import { addressOneLine, formatCountdown, PAYMENT_METHODS, type Address, type BagSummary, type PaymentMethod, type Quote } from "../../model/checkout"

/* ── the bag ─────────────────────────────────────────────────────── */

export function BagLines({ bag }: { bag: BagSummary }) {
  return (
    <ul className="shop-checkout__lines">
      {bag.lines.map((line) => (
        <li key={line.variantId} className="shop-checkout__line">
          <div className="shop-checkout__thumb" aria-hidden="true">
            {line.imageUrl ? <img src={line.imageUrl} alt="" loading="lazy" /> : null}
          </div>
          <div className="shop-checkout__line-body">
            <Link href={`/shop/products/${line.productId}`} className="shop-checkout__line-title">
              {line.title}
            </Link>
            <span className="shop-checkout__line-meta">
              {line.sku ? `${line.sku} · ` : ""}Qty {line.quantity}
              {!line.sellable ? " · Unavailable" : ""}
            </span>
          </div>
          <span className="shop-checkout__line-price">{inrMinor(line.lineTotalMinor)}</span>
        </li>
      ))}
    </ul>
  )
}

/* ── addresses ───────────────────────────────────────────────────── */

export function AddressPicker({
  addresses,
  selectedId,
  onSelect,
  onAdd,
  adding,
}: {
  addresses: Address[]
  selectedId: string
  onSelect: (id: string) => void
  onAdd: () => void
  adding: boolean
}) {
  return (
    <div className="shop-checkout__addresses" role="radiogroup" aria-label="Delivery address">
      {addresses.length === 0 && !adding ? (
        <p className="shop-checkout__hint">No saved address yet. Add one to see the delivery charge.</p>
      ) : null}
      {addresses.map((a) => {
        const selected = a.id === selectedId
        return (
          <label key={a.id} className={selected ? "shop-checkout__address is-selected" : "shop-checkout__address"}>
            <input type="radio" name="address" value={a.id} checked={selected} onChange={() => onSelect(a.id)} className="shop-checkout__radio" />
            <MapPin size={16} aria-hidden="true" className="shop-checkout__address-icon" />
            <span className="shop-checkout__address-body">
              <span className="shop-checkout__address-name">
                {a.contactName}
                <span className="shop-checkout__address-label">{ADDRESS_TYPE_LABELS[a.type]}</span>
                {a.isDefault ? <span className="shop-checkout__address-label">Default</span> : null}
              </span>
              <span className="shop-checkout__address-line">{addressOneLine(a)}</span>
              {a.phone ? <span className="shop-checkout__address-line">{a.phone}</span> : null}
            </span>
          </label>
        )
      })}
      {!adding ? (
        <button type="button" className="shop-checkout__add" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" />
          Add address
        </button>
      ) : null}
    </div>
  )
}

/* ── payment method ──────────────────────────────────────────────── */

export function PaymentMethodPicker({ value, onChange, disabled }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; disabled?: boolean }) {
  return (
    <div className="shop-checkout__methods" role="radiogroup" aria-label="Payment method">
      {PAYMENT_METHODS.map((m) => {
        const selected = m.value === value
        return (
          <label key={m.value} className={selected ? "shop-checkout__method is-selected" : "shop-checkout__method"}>
            <input type="radio" name="payment_method" value={m.value} checked={selected} onChange={() => onChange(m.value)} disabled={disabled} className="shop-checkout__radio" />
            <span className="shop-checkout__method-body">
              <span className="shop-checkout__method-label">{m.label}</span>
              <span className="shop-checkout__method-hint">{m.hint}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/* ── the quote ───────────────────────────────────────────────────── */

export function QuoteBreakdown({
  quote,
  secondsLeft,
  quoting,
  couponCode = "",
}: {
  quote: Quote | null
  secondsLeft: number
  quoting: boolean
  /** The code the quote was taken with; names the discount row. */
  couponCode?: string
}) {
  if (!quote) {
    return (
      <dl className="shop-checkout__totals" aria-busy={quoting}>
        {["Items", "Delivery", "Total"].map((label) => (
          <div key={label} className="shop-checkout__total-row">
            <dt>{label}</dt>
            <dd>{quoting ? <Skeleton className="h-4 w-16" /> : "—"}</dd>
          </div>
        ))}
      </dl>
    )
  }
  const arrives = arrivesByLine(quote.deliverBy)
  // The discount is the quote's figure; the row only names the code.
  const discount = discountRow(quote, couponCode)
  return (
    <div aria-busy={quoting}>
      {arrives ? (
        <p className="shop-checkout__arrives">
          <Truck size={14} aria-hidden="true" />
          <time dateTime={quote.deliverBy}>{arrives}</time>
        </p>
      ) : null}
      <dl className="shop-checkout__totals">
        <div className="shop-checkout__total-row">
          <dt>Items</dt>
          <dd>{inrMinor(quote.subtotalMinor)}</dd>
        </div>
        <div className="shop-checkout__total-row">
          <dt>Delivery</dt>
          <dd>{quote.shippingMinor === 0 ? "Free" : inrMinor(quote.shippingMinor)}</dd>
        </div>
        {discount ? (
          <div className="shop-checkout__total-row">
            <dt>{discount.label}</dt>
            <dd>−{inrMinor(discount.minor)}</dd>
          </div>
        ) : null}
        <div className="shop-checkout__total-row is-tax">
          <dt>Includes GST</dt>
          <dd>{inrMinor(quote.taxMinor)}</dd>
        </div>
        <div className="shop-checkout__total-row is-total">
          <dt>Total</dt>
          <dd>{inrMinor(quote.totalMinor)}</dd>
        </div>
      </dl>
      <p className={secondsLeft > 0 ? "shop-checkout__expiry" : "shop-checkout__expiry is-expired"}>
        <Clock size={12} aria-hidden="true" />
        {secondsLeft > 0 ? `Price held for ${formatCountdown(secondsLeft)}` : "This price has expired"}
      </p>
    </div>
  )
}
