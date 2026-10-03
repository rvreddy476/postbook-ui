"use client"

/* /feast/orders — the customer's orders, newest first as the server sends them. */

import { ChevronRight, Package } from "lucide-react"
import Link from "next/link"

import { toFeastError } from "../api/client"
import { formatWhen, Skel, StateBlock } from "../components/parts"
import { useOrders } from "../hooks/queries"
import { formatPaise } from "../model/money"
import { statusLabel } from "../model/tracking"

export function OrdersScreen() {
  const orders = useOrders()

  return (
    <>
      <div className="fc-head">
        <h1 className="fc-title">Your orders</h1>
      </div>
      {orders.isLoading ? (
        <div className="fc-stack">
          {Array.from({ length: 4 }, (_, i) => (
            <Skel key={i} h={64} />
          ))}
        </div>
      ) : orders.isError ? (
        <StateBlock
          icon={<Package size={22} />}
          title="Your orders couldn't be loaded"
          text={toFeastError(orders.error).message}
          action={
            <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => orders.refetch()}>
              Try again
            </button>
          }
        />
      ) : !orders.data?.length ? (
        <StateBlock
          icon={<Package size={22} />}
          title="No orders yet"
          text="Your food orders will show up here."
          action={
            <Link href="/feast" className="fc-btn fc-btn--primary fc-btn--sm">
              Find food
            </Link>
          }
        />
      ) : (
        <ul className="fc-stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
          {orders.data.map((o) => (
            <li key={o.id}>
              <Link href={`/feast/orders/${encodeURIComponent(o.id)}`} className="fc-card fc-row" style={{ flexDirection: "row", color: "inherit", textDecoration: "none" }}>
                <div className="fc-grow">
                  <div className="fc-row">
                    <strong className="fc-truncate">{o.restaurantName || "Order"}</strong>
                    <span className="fc-tag">{statusLabel(o.status)}</span>
                  </div>
                  <div className="fc-meta">
                    {o.orderNumber}
                    {o.placedAt ? ` · ${formatWhen(o.placedAt)}` : ""}
                  </div>
                </div>
                {o.finalAmountPaise !== null ? <span className="fc-price">{formatPaise(o.finalAmountPaise)}</span> : null}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
