"use client"

// /shop/sell/orders: GET /seller/fulfillment?stage= in offset pages, one
// stage pill at a time. Fulfilment is automatic on payment, so most rows are
// already shipped; the list says where each one is rather than what to do.

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import SegmentedControl from "@/components/ui/SegmentedControl"
import { inrMinor } from "../money"
import { useSellerOrderPages, useSellerStatus } from "../hooks/sell"
import {
  FULFILLMENT_STAGES,
  isFulfillmentStage,
  normaliseShipment,
  orderStatusUI,
  sellerStatusBanner,
  sellerSubtotalMinor,
  shortId,
  type FulfillmentStage,
  type SellerOrderCardWire,
} from "../model/sell"
import { EmptyState, ErrorState, PageHead, Pill, RowsSkeleton, formatWhen } from "../components/sell/primitives"
import { NotTradingYet } from "../components/sell/SellerShell"

export function OrdersScreen() {
  const status = useSellerStatus()
  const seller = status.data ?? null
  const canTrade = !!seller && sellerStatusBanner(seller).canTrade
  const params = useSearchParams()
  const router = useRouter()
  const fromUrl = params?.get("stage")
  const [stage, setStage] = useState<FulfillmentStage>(isFulfillmentStage(fromUrl) ? fromUrl : "all")
  const pages = useSellerOrderPages(stage, canTrade)

  if (!seller) return null
  if (!canTrade) {
    return (
      <div>
        <PageHead title="Orders" />
        <NotTradingYet seller={seller} />
      </div>
    )
  }

  const orders = pages.data?.pages.flatMap((p) => p.orders) ?? []

  return (
    <div>
      <PageHead title="Orders" />
      <SegmentedControl
        layoutId="shop-sell-orders-stage"
        aria-label="Order stage"
        size="sm"
        segments={FULFILLMENT_STAGES.map((s) => ({ id: s.id, label: s.label }))}
        value={stage}
        onChange={(id) => {
          if (!isFulfillmentStage(id)) return
          setStage(id)
          router.replace(id === "all" ? "/shop/sell/orders" : `/shop/sell/orders?stage=${id}`)
        }}
        className="shop-sell-pills"
      />
      {pages.isPending ? (
        <RowsSkeleton rows={5} />
      ) : pages.isError ? (
        <ErrorState text="Your orders could not be loaded." onRetry={() => void pages.refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState text={stage === "all" ? "No orders yet." : "No orders at this stage."} />
      ) : (
        <>
          <ul className="shop-sell-list">
            {orders.map((card) => (
              <OrderRow key={card.order.id} card={card} />
            ))}
          </ul>
          {pages.hasNextPage ? (
            <div className="shop-sell-pager">
              <Button variant="ghost" size="sm" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>
                {pages.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function OrderRow({ card }: { card: SellerOrderCardWire }) {
  const ui = orderStatusUI(card.order.status)
  const shipment = normaliseShipment(card.shipment)
  const count = card.items.reduce((n, it) => n + (it.quantity || 0), 0)
  return (
    <li className="shop-sell-list__row">
      <div>
        <Link href={`/shop/sell/orders/${card.order.id}`} className="shop-sell-link">
          {card.order.order_number || shortId(card.order.id)}
        </Link>
        <p className="shop-sell-muted">
          {count} item{count === 1 ? "" : "s"} · {formatWhen(card.order.created_at)}
          {shipment?.courier ? ` · ${shipment.courier}${shipment.tracking_number ? ` ${shipment.tracking_number}` : ""}` : ""}
        </p>
      </div>
      <div className="shop-sell-list__end">
        <span className="shop-sell-price">{inrMinor(sellerSubtotalMinor(card))}</span>
        <Pill tone={ui.tone}>{ui.label}</Pill>
      </div>
    </li>
  )
}
