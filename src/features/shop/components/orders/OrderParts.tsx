"use client"

/*
  The presentational pieces of the orders screens: props in, callbacks
  out. Words and states come from model/orders.ts and orders/timeline.ts.
*/

import { Check, ExternalLink, Package } from "lucide-react"
import Link from "next/link"

import { inrMinor } from "@/features/shop/money"

import { formatOrderDate, formatOrderDateTime, itemCountLabel, statusLabel, type OrderItem, type OrderRow } from "../../model/orders"
import type { TimelineEntry } from "../../orders/timeline"

/* ── the pill ────────────────────────────────────────────────────── */

export function StatusPill({ status }: { status: string }) {
  const { label, tone } = statusLabel(status)
  return <span className={`shop-status is-${tone}`}>{label}</span>
}

/* ── a row on /shop/orders ───────────────────────────────────────── */

export function OrderRowCard({ row }: { row: OrderRow }) {
  return (
    <Link href={`/shop/orders/${row.id}`} className="shop-order-row">
      <div className="shop-order-row__thumb" aria-hidden="true">
        {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" loading="lazy" /> : <Package size={20} />}
      </div>
      <div className="shop-order-row__body">
        <span className="shop-order-row__number">
          Order {row.orderNumber}
          <StatusPill status={row.status} />
        </span>
        <span className="shop-order-row__meta">
          {formatOrderDate(row.createdAtMs)}
          {row.firstProductTitle ? ` · ${row.firstProductTitle}` : ""}
          {row.itemCount > 1 ? ` and ${row.itemCount - 1} more` : ""}
        </span>
        <span className="shop-order-row__meta">{itemCountLabel(row.itemCount)}</span>
      </div>
      <span className="shop-order-row__total">{inrMinor(row.totalMinor)}</span>
    </Link>
  )
}

/* ── the items on an order ───────────────────────────────────────── */

export function OrderItems({ items, orderId, canReview }: { items: OrderItem[]; orderId: string; canReview: boolean }) {
  return (
    <ul className="shop-order__items">
      {items.map((item) => (
        <li key={item.id || item.variantId} className="shop-order__item">
          <div className="shop-order__thumb" aria-hidden="true">
            {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <Package size={18} />}
          </div>
          <div className="shop-order__item-body">
            <Link href={`/shop/products/${item.productId}`} className="shop-order__item-title">
              {item.title}
            </Link>
            <span className="shop-order__item-meta">
              {item.optionsLabel ? `${item.optionsLabel} · ` : ""}Qty {item.quantity}
              {item.unitMrpMinor > item.unitPriceMinor ? (
                <>
                  {" · "}
                  <s>{inrMinor(item.unitMrpMinor)}</s>
                </>
              ) : null}
            </span>
            {canReview && item.delivered ? (
              <Link href={`/shop/orders/${orderId}/review?product=${encodeURIComponent(item.productId)}`} className="shop-link shop-order__review">
                Write a review
              </Link>
            ) : null}
          </div>
          <span className="shop-order__item-price">{inrMinor(item.lineTotalMinor)}</span>
        </li>
      ))}
    </ul>
  )
}

/* ── the timeline ────────────────────────────────────────────────── */

export function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="shop-timeline">
      {entries.map((entry) => (
        <li key={entry.key} className={`shop-timeline__step is-${entry.state}`}>
          <span className="shop-timeline__dot" aria-hidden="true">
            {entry.state === "done" ? <Check size={10} /> : null}
          </span>
          <div className="shop-timeline__body">
            <span className="shop-timeline__label">{entry.label}</span>
            {entry.atMs ? <span className="shop-timeline__time">{formatOrderDateTime(entry.atMs)}</span> : null}
            {entry.events.length ? (
              <ul className="shop-timeline__events">
                {entry.events.map((ev) => (
                  <li key={ev.key} className="shop-timeline__event">
                    <span>{ev.label}</span>
                    {ev.location ? <span className="shop-timeline__event-meta"> · {ev.location}</span> : null}
                    {ev.remark ? <span className="shop-timeline__event-meta"> · {ev.remark}</span> : null}
                    {ev.atMs ? <span className="shop-timeline__event-meta"> · {formatOrderDateTime(ev.atMs)}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ── the tracking line ───────────────────────────────────────────── */

export function TrackingLine({ courier, trackingNumber, trackingUrl }: { courier: string; trackingNumber: string; trackingUrl: string }) {
  return (
    <p className="shop-order__tracking">
      {courier ? <span>{courier}</span> : null}
      {trackingNumber ? <span className="shop-order__awb">AWB {trackingNumber}</span> : null}
      {trackingUrl ? (
        <a href={trackingUrl} target="_blank" rel="noreferrer noopener" className="shop-link shop-order__track">
          Track
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : null}
    </p>
  )
}
