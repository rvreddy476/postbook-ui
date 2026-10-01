"use client"

/*
  /shop/orders/[id] — one order: items, address, totals, the status
  timeline from the shipments, tracking, the invoice, cancel, and the
  payment leg when the order is still waiting for money.

  With `?confirming=1` (checkout lands here) the page polls
  GET /orders/:id/payment on the contract's schedule. Nothing on this page
  marks the order paid; the poll reads what the webhook wrote.
*/

import { ArrowLeft, FileText, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useGlobalToast } from "@/contexts/ToastContext"
import { inrMinor } from "@/features/shop/money"

import "../shop.css"

import { startPayment } from "../checkout/startPayment"
import { OrderOfferLine } from "../components/offers/BankOffers"
import { OrderItems, OrderTimeline, StatusPill, TrackingLine } from "../components/orders/OrderParts"
import { orderDetailKey, ORDERS_LIST_KEY, useCancelOrder, useInvoiceLink, useOrder, useShipments } from "../hooks/orders"
import { useConfirmStubPayment, useOpenPaymentIntent, usePaymentPoll } from "../hooks/payments"
import { errorCode } from "../model/checkout"
import { orderOfferLine } from "../model/offers"
import { canShowInvoice, formatOrderDate, retryPaymentLabel } from "../model/orders"
import { forgetIntent, recallIntent, rememberIntent, showsStubButton, stubConfirmBody, toPaymentIntent, type PaymentIntent } from "../model/payments"
import { buildTimeline, trackingSummary } from "./timeline"

function sessionStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const params = useSearchParams()
  const qc = useQueryClient()
  const toast = useGlobalToast()
  const orderQuery = useOrder(orderId)
  const order = orderQuery.data
  const awaitingPayment = !order || order.status === "payment_pending"
  const shipmentsQuery = useShipments(orderId, !!order && order.paymentStatus === "paid")
  const openIntent = useOpenPaymentIntent()
  const confirmStub = useConfirmStubPayment()
  const invoice = useInvoiceLink()
  const cancel = useCancelOrder()

  const [confirming, setConfirming] = useState(() => params.get("confirming") === "1")
  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [dialogDismissed, setDialogDismissed] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const announced = useRef<string>("")

  // The intent checkout opened, if this is the same tab.
  useEffect(() => {
    const wire = recallIntent(sessionStore(), orderId)
    if (wire) setIntent(toPaymentIntent(wire))
  }, [orderId])

  const poll = usePaymentPoll(orderId, confirming && awaitingPayment)

  // The order itself is the last word: once it reads paid (or has died),
  // there is nothing left to confirm, whatever the poll had got to.
  useEffect(() => {
    if (!order) return
    if (order.paymentStatus === "paid" || order.status === "payment_failed" || order.status === "cancelled" || order.status === "expired") {
      setConfirming(false)
    }
  }, [order])

  // The poll's verdict: the order is re-read, and the buyer is told once.
  useEffect(() => {
    const phase = poll.state.phase
    if (phase === "confirming" || announced.current === phase) return
    announced.current = phase
    if (phase === "paid" || phase === "failed") {
      void qc.invalidateQueries({ queryKey: orderDetailKey(orderId) })
      void qc.invalidateQueries({ queryKey: ORDERS_LIST_KEY })
      forgetIntent(sessionStore(), orderId)
      setIntent(null)
      setConfirming(false)
      toast(phase === "paid" ? { type: "success", title: "Payment confirmed" } : { type: "error", title: "Payment failed", description: "Nothing was charged. You can try again." })
    }
  }, [poll.state.phase, orderId, qc, toast])

  const shipments = shipmentsQuery.data || []
  const timeline = useMemo(
    () => (order ? buildTimeline({ status: order.status, paymentStatus: order.paymentStatus, createdAtMs: order.createdAtMs, shipments }) : []),
    [order, shipments],
  )
  const tracking = useMemo(() => {
    const fromShipments = trackingSummary(shipments)
    if (fromShipments) return { ...fromShipments, trackingUrl: fromShipments.trackingUrl || order?.trackingUrl || "" }
    return order?.trackingUrl ? { courier: "", trackingNumber: "", trackingUrl: order.trackingUrl } : null
  }, [shipments, order])

  const onPayAgain = async () => {
    if (!order) return
    setDialogDismissed(false)
    try {
      const { wire, intent: fresh } = await openIntent.mutateAsync(orderId)
      rememberIntent(sessionStore(), orderId, wire)
      setIntent(fresh)
      announced.current = ""
      const start = startPayment(fresh, order.orderNumber)
      if (start.kind === "unavailable") {
        toast({ type: "error", title: "Payment isn't available right now", description: "Try again in a little while." })
        return
      }
      // A retried failed order is payment_pending again: re-read it, and poll.
      void qc.invalidateQueries({ queryKey: orderDetailKey(orderId) })
      setConfirming(true)
      poll.restart()
      if (start.kind === "razorpay") {
        void start.dialog.then((ended) => {
          if (ended === "dismissed") setDialogDismissed(true)
        })
      }
    } catch (error) {
      const code = errorCode(error)
      if (code === "OUT_OF_STOCK") toast({ type: "error", title: "Out of stock", description: "Something in this order sold out. It can't be paid for now." })
      else if (code === "ORDER_NOT_PAYABLE") toast({ type: "info", title: "This order isn't waiting for payment" })
      else toast({ type: "error", title: "Payment couldn't be opened", description: "Try again." })
    }
  }

  const onSimulate = async () => {
    if (!intent) return
    try {
      await confirmStub.mutateAsync({ orderId, body: stubConfirmBody(intent) })
      announced.current = ""
      setConfirming(true)
      poll.restart()
    } catch {
      toast({ type: "error", title: "The stub didn't settle", description: "Is PAYMENTS_ALLOW_STUB on?" })
    }
  }

  const onInvoice = async () => {
    // Open the tab before the await so the browser counts it as the click's.
    const tab = typeof window !== "undefined" ? window.open("", "_blank", "noopener") : null
    try {
      const link = await invoice.mutateAsync(orderId)
      if (!link) throw new Error("no invoice")
      if (tab) tab.location.href = link.url
      else window.open(link.url, "_blank", "noopener")
    } catch {
      tab?.close()
      toast({ type: "info", title: "The invoice isn't ready yet", description: "It's issued shortly after payment." })
    }
  }

  const onCancel = async () => {
    try {
      await cancel.mutateAsync({ orderId, reason: cancelReason.trim() })
      setCancelOpen(false)
      setCancelReason("")
      toast({ type: "success", title: "Order cancelled", description: "Any payment is refunded automatically." })
    } catch (error) {
      const code = errorCode(error)
      toast({ type: "error", title: code === "CANCEL_NOT_PERMITTED" ? "This order can no longer be cancelled" : "The order couldn't be cancelled" })
    }
  }

  if (orderQuery.isLoading) {
    return (
      <div className="shop-order">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="shop-state">
        <p>This order couldn't be found.</p>
        <Link href="/shop/orders" className="shop-link">
          Your orders
        </Link>
      </div>
    )
  }

  const payLabel = retryPaymentLabel(order)
  const pollPhase = poll.state.phase
  const showConfirmingPanel = order.status === "payment_pending" || order.status === "payment_failed" || confirming

  return (
    <div className="shop-order">
      <div className="shop-order__head">
        <Link href="/shop/orders" className="shop-w2-back" aria-label="Back to orders">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="shop-order__title">
          <h1 className="shop-w2-title">Order {order.orderNumber}</h1>
          <span className="shop-order__date">{formatOrderDate(order.createdAtMs)}</span>
        </div>
        <StatusPill status={order.status} />
      </div>

      {showConfirmingPanel ? (
        <section className="shop-w2-sec shop-confirming" aria-live="polite">
          {confirming && pollPhase === "confirming" ? (
            <p className="shop-confirming__line">
              <Loader2 size={16} aria-hidden="true" className="shop-spin" />
              Confirming your payment…
            </p>
          ) : null}
          {pollPhase === "timed_out" ? (
            <p className="shop-confirming__line">
              Still confirming. We'll update this page once the payment lands.
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  announced.current = ""
                  void orderQuery.refetch()
                  poll.restart()
                }}
              >
                <RefreshCw size={14} aria-hidden="true" />
                Refresh
              </Button>
            </p>
          ) : null}
          {pollPhase === "stopped" ? <p className="shop-confirming__line">We couldn't check this payment. Open your orders again in a moment.</p> : null}
          {dialogDismissed ? <p className="shop-confirming__line">The payment page was closed before paying. Nothing was charged.</p> : null}
          {order.status === "payment_failed" ? <p className="shop-confirming__line">The payment didn't go through. Nothing was charged.</p> : null}
          {order.canRetryPayment ? (
            <div className="shop-confirming__actions">
              <Button size="md" onClick={onPayAgain} disabled={openIntent.isPending}>
                {openIntent.isPending ? "Opening payment…" : payLabel}
              </Button>
              {showsStubButton(intent) ? (
                <Button variant="outline" size="md" onClick={onSimulate} disabled={confirmStub.isPending}>
                  {confirmStub.isPending ? "Settling…" : "Simulate payment (dev)"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="shop-order__grid">
        <div className="shop-order__main">
          <section className="shop-w2-sec">
            <h2 className="shop-w2-sec__title">Items</h2>
            <OrderItems items={order.items} orderId={order.id} canReview={order.paymentStatus === "paid"} />
          </section>

          <section className="shop-w2-sec">
            <h2 className="shop-w2-sec__title">Progress</h2>
            {tracking ? <TrackingLine courier={tracking.courier} trackingNumber={tracking.trackingNumber} trackingUrl={tracking.trackingUrl} /> : null}
            <OrderTimeline entries={timeline} />
          </section>
        </div>

        <aside className="shop-order__aside">
          {order.address ? (
            <section className="shop-w2-sec">
              <h2 className="shop-w2-sec__title">Delivering to</h2>
              <address className="shop-order__address">
                <span className="shop-order__address-name">{order.address.contactName}</span>
                {order.address.lines.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
                {order.address.phone ? <span>{order.address.phone}</span> : null}
              </address>
            </section>
          ) : null}

          <section className="shop-w2-sec">
            <h2 className="shop-w2-sec__title">Total</h2>
            <dl className="shop-checkout__totals">
              <div className="shop-checkout__total-row">
                <dt>Items</dt>
                <dd>{inrMinor(order.subtotalMinor)}</dd>
              </div>
              <div className="shop-checkout__total-row">
                <dt>Delivery</dt>
                <dd>{order.shippingMinor === 0 ? "Free" : inrMinor(order.shippingMinor)}</dd>
              </div>
              {order.discountMinor > 0 ? (
                <div className="shop-checkout__total-row">
                  <dt>Discount</dt>
                  <dd>−{inrMinor(order.discountMinor)}</dd>
                </div>
              ) : null}
              <div className="shop-checkout__total-row is-tax">
                <dt>Includes GST</dt>
                <dd>{inrMinor(order.taxMinor)}</dd>
              </div>
              <div className="shop-checkout__total-row is-total">
                <dt>Total</dt>
                <dd>{inrMinor(order.totalMinor)}</dd>
              </div>
            </dl>
            {order.paymentOffer ? <OrderOfferLine line={orderOfferLine(order.paymentOffer, inrMinor)} title={order.paymentOffer.title} /> : null}
            {order.paymentMethod ? <p className="shop-order__paid-with">Paid with {order.paymentMethod.toUpperCase()}</p> : null}
            <div className="shop-order__actions">
              {canShowInvoice(order) ? (
                <Button variant="outline" size="sm" onClick={onInvoice} disabled={invoice.isPending}>
                  <FileText size={14} aria-hidden="true" />
                  Invoice
                </Button>
              ) : null}
              {order.canCancel ? (
                <Button variant="ghost" size="sm" className="shop-danger" onClick={() => setCancelOpen(true)}>
                  Cancel order
                </Button>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this order?">
        <div className="shop-cancel">
          <p className="shop-cancel__text">Any payment already made is refunded automatically.</p>
          <label className="shop-cancel__label">
            Why are you cancelling? (optional)
            <textarea className="shop-cancel__reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} maxLength={500} />
          </label>
          <div className="shop-cancel__actions">
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)} disabled={cancel.isPending}>
              Keep order
            </Button>
            <Button size="sm" className="shop-danger-fill" onClick={onCancel} disabled={cancel.isPending}>
              {cancel.isPending ? "Cancelling…" : "Cancel order"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
