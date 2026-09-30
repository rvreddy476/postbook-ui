"use client"

// /shop/sell/orders/[id]: GET /seller/orders/:id (items, the buyer address
// snapshot, seller_subtotal_minor), GET /seller/orders/:id/history for the
// timeline (GET /orders/:id/shipments for courier events), and the actions
// migration 010 permits a seller from the order's status: Pack, Ship, Cancel.

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useGlobalToast } from "@/contexts/ToastContext"
import { inrMinor } from "../money"
import { useCancelSellerOrder, useOrderShipments, usePackOrder, useSellerOrder, useSellerOrderHistory, useSellerStatus, useShipOrder } from "../hooks/sell"
import {
  addressIsRoutingOnly,
  buildTimeline,
  canBookShipment,
  decodeAddressSnapshot,
  isNotFound,
  lineTotalMinor,
  normaliseShipment,
  orderStatusUI,
  sellerActionError,
  sellerActionsFor,
  sellerStatusBanner,
  sellerSubtotalMinor,
  shortId,
  timelineFromHistory,
  variantSummary,
} from "../model/sell"
import { CancelForm } from "../components/sell/CancelForm"
import { ShipForm } from "../components/sell/ShipForm"
import { ErrorState, Notice, PageHead, Panel, Pill, RowsSkeleton, formatWhen } from "../components/sell/primitives"
import { NotTradingYet } from "../components/sell/SellerShell"

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const status = useSellerStatus()
  const seller = status.data ?? null
  const canTrade = !!seller && sellerStatusBanner(seller).canTrade
  const order = useSellerOrder(canTrade ? orderId : null)
  const history = useSellerOrderHistory(canTrade ? orderId : null)
  const shipments = useOrderShipments(canTrade ? orderId : null)
  const pack = usePackOrder()
  const ship = useShipOrder()
  const cancel = useCancelSellerOrder()
  const toast = useGlobalToast()
  const [mode, setMode] = useState<"none" | "ship" | "cancel">("none")
  const [actionError, setActionError] = useState<string | null>(null)

  if (!seller) return null
  if (!canTrade) {
    return (
      <div>
        <PageHead title="Order" />
        <NotTradingYet seller={seller} />
      </div>
    )
  }
  if (order.isPending) return <RowsSkeleton rows={6} />
  if (order.isError || !order.data) {
    return <ErrorState text={isNotFound(order.error) ? "This order is not in your shop." : "The order could not be loaded."} onRetry={() => void order.refetch()} />
  }

  const card = order.data
  const o = card.order
  const ui = orderStatusUI(o.status)
  const shipment = normaliseShipment(card.shipment)
  const mine = (shipments.data ?? []).find((s) => (shipment ? s.shipment.id === shipment.id : true)) ?? null
  const events = mine?.events ?? []
  const timeline = history.data && history.data.length > 0 ? timelineFromHistory(history.data, events) : buildTimeline(o, mine?.shipment ?? shipment, events)
  const address = decodeAddressSnapshot(card.delivery_address)
  const actions = sellerActionsFor(o.status)
  const shipLive = canBookShipment(o, mine?.shipment ?? shipment)
  const busy = pack.isPending || ship.isPending || cancel.isPending

  async function doPack() {
    setActionError(null)
    try {
      const res = await pack.mutateAsync({ orderId })
      toast({ type: "success", title: res.applied ? "Marked as packed" : "Already packed" })
    } catch (err) {
      setActionError(sellerActionError("pack", err, "The order could not be marked as packed."))
    }
  }

  return (
    <div>
      <PageHead
        title={`Order ${o.order_number || shortId(o.id)}`}
        sub={`Placed ${formatWhen(o.created_at)}`}
        actions={
          <Link href="/shop/sell/orders" className="shop-sell-link">
            All orders
          </Link>
        }
      />
      <div className="shop-sell-order__status">
        <Pill tone={ui.tone}>{ui.label}</Pill>
        {o.payment_status ? <span className="shop-sell-muted">Payment: {o.payment_status}</span> : null}
      </div>

      <div className="shop-sell-order">
        <Panel title="Items">
          <ul className="shop-sell-list">
            {card.items.map((it) => (
              <li key={it.id} className="shop-sell-list__row">
                <div className="shop-sell-table__listing">
                  {it.thumbnail_url || it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumbnail_url || it.image_url} alt="" className="shop-sell-thumb" loading="lazy" />
                  ) : (
                    <span className="shop-sell-thumb shop-sell-thumb--empty" aria-hidden="true" />
                  )}
                  <div>
                    <p>{it.product_title || "Item"}</p>
                    <p className="shop-sell-muted">
                      {[variantSummary(it.variant_details), it.sku ? `SKU ${it.sku}` : "", `× ${it.quantity || 0}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <span className="shop-sell-price">{inrMinor(lineTotalMinor(it))}</span>
              </li>
            ))}
          </ul>
          <p className="shop-sell-order__total">
            <span>Your subtotal</span>
            <span className="shop-sell-price">{inrMinor(sellerSubtotalMinor(card))}</span>
          </p>
        </Panel>

        <Panel title="Deliver to">
          {address ? (
            <address className="shop-sell-address">
              {address.contact_name ? <div>{address.contact_name}</div> : null}
              {address.address_line_1 ? <div>{address.address_line_1}</div> : null}
              {address.address_line_2 ? <div>{address.address_line_2}</div> : null}
              {address.landmark ? <div>{address.landmark}</div> : null}
              <div>{[address.city, address.state, address.postal_code].filter(Boolean).join(", ")}</div>
              {address.phone ? <div>{address.phone}</div> : null}
              {addressIsRoutingOnly(address) ? <p className="shop-sell-muted">The courier label carries the full address; only the routing fields are shown here.</p> : null}
            </address>
          ) : (
            <p className="shop-sell-muted">No address snapshot on this order.</p>
          )}
          {o.gift_message ? <p className="shop-sell-muted">Gift note: {o.gift_message}</p> : null}
        </Panel>

        <Panel title="Shipment">
          {mine?.shipment || shipment ? (
            <dl className="shop-sell-dl">
              <dt>Courier</dt>
              <dd>{(mine?.shipment ?? shipment)?.courier || "—"}</dd>
              <dt>Tracking</dt>
              <dd>
                {(mine?.shipment ?? shipment)?.tracking_url ? (
                  <a href={(mine?.shipment ?? shipment)?.tracking_url ?? "#"} target="_blank" rel="noreferrer" className="shop-sell-link">
                    {(mine?.shipment ?? shipment)?.tracking_number || "Track"}
                  </a>
                ) : (
                  (mine?.shipment ?? shipment)?.tracking_number || "—"
                )}
              </dd>
              <dt>Status</dt>
              <dd>{orderStatusUI((mine?.shipment ?? shipment)?.status).label}</dd>
            </dl>
          ) : (
            <p className="shop-sell-muted">Not booked yet. Fulfilment is automatic once the payment lands; the courier is booked for you.</p>
          )}
        </Panel>

        <Panel title="History">
          {history.isPending && shipments.isPending ? (
            <RowsSkeleton rows={3} />
          ) : timeline.length === 0 ? (
            <p className="shop-sell-muted">Nothing recorded yet.</p>
          ) : (
            <ol className="shop-sell-timeline">
              {timeline.map((t) => (
                <li key={t.key}>
                  <span className="shop-sell-timeline__label">{t.label}</span>
                  <span className="shop-sell-muted">{[formatWhen(t.at), t.detail].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {actions.length > 0 ? (
          <Panel title="Actions" sub="Only what the order's status allows right now.">
            {actionError ? <Notice tone="danger">{actionError}</Notice> : null}
            {mode === "ship" ? (
              <ShipForm
                busy={ship.isPending}
                error={null}
                onCancel={() => setMode("none")}
                onSubmit={(values) => {
                  setActionError(null)
                  ship.mutateAsync({ orderId, values }).then(
                    () => {
                      toast({ type: "success", title: "Shipment booked" })
                      setMode("none")
                    },
                    (err) => setActionError(sellerActionError("ship", err, "The shipment could not be booked.")),
                  )
                }}
              />
            ) : mode === "cancel" ? (
              <CancelForm
                busy={cancel.isPending}
                error={null}
                onCancel={() => setMode("none")}
                onSubmit={(reason) => {
                  setActionError(null)
                  cancel.mutateAsync({ orderId, reason }).then(
                    (res) => {
                      toast({ type: "success", title: res.applied ? "Order cancelled" : "Already cancelled" })
                      setMode("none")
                    },
                    (err) => setActionError(sellerActionError("cancel", err, "The order could not be cancelled.")),
                  )
                }}
              />
            ) : (
              <div className="shop-sell-actions">
                {actions.some((a) => a.kind === "pack") ? (
                  <Button disabled={busy} onClick={() => void doPack()}>
                    {pack.isPending ? "Packing…" : "Pack"}
                  </Button>
                ) : null}
                {actions.some((a) => a.kind === "ship") ? (
                  <Button disabled={busy || !shipLive} onClick={() => setMode("ship")} title={shipLive ? undefined : "Waiting for payment, or a shipment already exists."}>
                    Ship
                  </Button>
                ) : null}
                {actions.some((a) => a.kind === "cancel") ? (
                  <Button variant="outline" disabled={busy} onClick={() => setMode("cancel")}>
                    Cancel order
                  </Button>
                ) : null}
              </div>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  )
}
