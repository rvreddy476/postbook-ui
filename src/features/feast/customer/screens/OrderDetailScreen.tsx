"use client"

/*
  /feast/orders/[id] — payment, live tracking and the invoice for one order.

  Payment: while the order is PAYMENT_PENDING the panel pays for THIS order
  (a retry never places another). "Paid" is only ever the server's
  GET /orders/:id/payment reading.

  Live: a scoped realtime token + SSE when it connects; polling every 10 s
  whenever it is not connected (30 s while it is, as a safety net). The
  rider's pin moves only to a newer fix. The delivery code shows only while
  the rider has the food.
*/

import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Bike, CheckCircle2, FileText, MapPin, Package, Store } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { toFeastError } from "../api/client"
import { InvoiceView } from "../components/InvoiceView"
import { Bill, Busy, formatWhen, Skel, StateBlock, VegMark } from "../components/parts"
import { useLiveOrder } from "../hooks/live"
import { useOrderPayment } from "../hooks/payment"
import { keys, useCancelOrder, useOrder, useTracking } from "../hooks/queries"
import { formatPaise } from "../model/money"
import { PAYMENT_LINES, PAYMENT_METHODS, type PaymentMethod } from "../model/payment"
import { canCancel, deliveryCodeVisible, isTerminal, LIVE_POLL_MS, mapsLink, newerRiderFix, statusLabel } from "../model/tracking"
import type { Order, Point } from "../model/wire"

const SLOW_POLL_MS = 30_000

function PaymentPanel({ order, autoMethod, onAutoDone }: { order: Order; autoMethod: PaymentMethod | null; onAutoDone: () => void }) {
  const { phase, start, settleStub, poll } = useOrderPayment(order.id, order.orderNumber)
  const [method, setMethod] = useState<PaymentMethod>(autoMethod ?? "upi")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (autoMethod) {
      onAutoDone()
      void start(autoMethod)
    } else {
      // Arriving later (reload, from the list): read the server's verdict quietly.
      poll(true)
    }
  }, [autoMethod, onAutoDone, poll, start])

  const failed = phase.kind === "settled" && phase.reading === "failed"
  const working = phase.kind === "opening" || phase.kind === "dialog" || phase.kind === "confirming"

  return (
    <section className="fc-card" aria-labelledby="fc-pay" aria-live="polite">
      <h2 id="fc-pay" className="fc-h2">Payment</h2>
      {phase.kind === "opening" ? <Busy label="Opening the payment…" /> : null}
      {phase.kind === "dialog" ? <Busy label="Finish paying in the Razorpay window." /> : null}
      {phase.kind === "confirming" ? <Busy label={PAYMENT_LINES.confirming} /> : null}
      {phase.kind === "timeout" ? (
        <div className="fc-stack">
          <p className="fc-info">We&apos;re still waiting to hear from the bank. If money left your account it will be confirmed or refunded automatically.</p>
          <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => poll()}>
            Check again
          </button>
        </div>
      ) : null}
      {phase.kind === "settled" && phase.reading !== "failed" ? (
        <p className={phase.reading === "paid" ? "fc-ok" : "fc-info"}>{PAYMENT_LINES[phase.reading]}</p>
      ) : null}
      {failed ? <p className="fc-alert">{PAYMENT_LINES.failed}. You can try again on this same order.</p> : null}
      {phase.kind === "unavailable" || phase.kind === "error" ? <p className="fc-alert" role="alert">{phase.message}</p> : null}
      {phase.kind === "stub" ? (
        <div className="fc-stack">
          <p className="fc-note">Development payments are on. This settles the stub gateway; the order is marked paid only when the server says so.</p>
          <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => void settleStub(phase.intent)}>
            Simulate payment (dev)
          </button>
        </div>
      ) : null}

      {!working && phase.kind !== "stub" && !(phase.kind === "settled" && phase.reading !== "failed") ? (
        <div className="fc-stack">
          <div className="fc-row" role="radiogroup" aria-label="Payment method" style={{ flexWrap: "wrap" }}>
            {PAYMENT_METHODS.map((m) => (
              <label key={m.value} className={method === m.value ? "fc-choice is-on" : "fc-choice"}>
                <input type="radio" name="pay-method" checked={method === m.value} onChange={() => setMethod(m.value)} />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          <button type="button" className="fc-btn fc-btn--primary" onClick={() => void start(method, phase.kind !== "idle")}>
            {phase.kind === "idle" ? "Pay" : "Try again"}
            {order.finalAmountPaise !== null ? ` ${formatPaise(order.finalAmountPaise)}` : ""}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function Tracker({ order }: { order: Order }) {
  const qc = useQueryClient()
  const live = !isTerminal(order.status) && order.status !== "PAYMENT_PENDING"
  const [fix, setFix] = useState<Point | null>(null)

  const onChange = useCallback(() => {
    void qc.invalidateQueries({ queryKey: keys.order(order.id) })
    void qc.invalidateQueries({ queryKey: keys.tracking(order.id) })
  }, [order.id, qc])
  const onFix = useCallback((next: Point) => setFix((prev) => newerRiderFix(prev, next)), [])
  const { connected } = useLiveOrder(order.id, live, { onChange, onFix })

  const interval = live ? (connected ? SLOW_POLL_MS : LIVE_POLL_MS) : false
  const tracking = useTracking(order.id, order.status !== "PAYMENT_PENDING", interval)
  // The order itself is polled by the page at the same cadence.
  useOrder(order.id, interval)

  useEffect(() => {
    if (tracking.data?.deliveryLocation) setFix((prev) => newerRiderFix(prev, tracking.data?.deliveryLocation))
  }, [tracking.data])

  const t = tracking.data
  const trackingStatus = t?.status ?? null
  const showCode = deliveryCodeVisible(order.status, order.deliveryCode) && (!trackingStatus || deliveryCodeVisible(trackingStatus, order.deliveryCode))
  const steps = t?.timeline.length
    ? t.timeline.map((s) => ({ key: `${s.toStatus}-${s.createdAt}`, label: s.label || statusLabel(s.toStatus), done: s.completed, at: s.createdAt }))
    : order.history.map((h) => ({ key: `${h.toStatus}-${h.createdAt}`, label: statusLabel(h.toStatus), done: true, at: h.createdAt }))
  const eta = t?.etaAt ?? order.etaAt
  const riderLink = mapsLink(fix)

  return (
    <section className="fc-card" aria-labelledby="fc-track">
      <div className="fc-row">
        <h2 id="fc-track" className="fc-h2 fc-grow">{statusLabel(order.status)}</h2>
        {live ? <span className={connected ? "fc-live is-on" : "fc-live"}>{connected ? "Live" : "Updating every 10 s"}</span> : null}
      </div>
      {eta && live ? <p className="fc-sub" style={{ margin: 0 }}>Arriving around {new Date(eta).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p> : null}

      {showCode ? (
        <div className="fc-code" role="note" aria-label="Delivery code">
          <div>
            <div style={{ fontWeight: 600 }}>Delivery code</div>
            <div className="fc-meta">Tell this to your delivery partner when they arrive.</div>
          </div>
          <span className="fc-code__digits">{order.deliveryCode}</span>
        </div>
      ) : null}

      {live ? (
        <div className="fc-map">
          <Bike size={22} aria-hidden="true" />
          {fix ? (
            <>
              <span>Your delivery partner was last seen at {fix.recordedAt ? formatWhen(fix.recordedAt) : "a recent point"}.</span>
              {riderLink ? (
                <a className="fc-link" href={riderLink} target="_blank" rel="noopener noreferrer">
                  Open in maps
                </a>
              ) : null}
            </>
          ) : (
            <span>A live map isn&apos;t available here yet. You&apos;ll see the rider&apos;s position once they&apos;re on the way.</span>
          )}
        </div>
      ) : null}

      {tracking.isError && live ? <p className="fc-note">Live details couldn&apos;t be loaded; the status above still updates.</p> : null}

      {steps.length ? (
        <ol className="fc-steps" aria-label="Progress">
          {steps.map((s) => (
            <li key={s.key} className={s.done ? "fc-step is-done" : "fc-step"}>
              <span className="fc-step__dot" aria-hidden="true" />
              <span>
                <span style={{ fontWeight: 500 }}>{s.label}</span>
                {s.at ? <span className="fc-meta" style={{ display: "block" }}>{formatWhen(s.at)}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const order = useOrder(orderId)
  const cancel = useCancelOrder()
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [askCancel, setAskCancel] = useState(false)

  const payParam = params?.get("pay")
  const autoMethod: PaymentMethod | null = payParam === "upi" || payParam === "card" ? payParam : null
  const clearParam = useCallback(() => router.replace(`/feast/orders/${encodeURIComponent(orderId)}`, { scroll: false }), [orderId, router])

  if (order.isLoading) {
    return (
      <div className="fc-stack">
        <Skel h={22} w="40%" />
        <Skel h={140} />
        <Skel h={200} />
      </div>
    )
  }
  if (order.isError || !order.data) {
    const e = toFeastError(order.error)
    return (
      <StateBlock
        icon={<Package size={22} />}
        title={e.status === 404 ? "Order not found" : "This order couldn't be loaded"}
        text={e.status === 404 ? undefined : e.message}
        action={
          <Link href="/feast/orders" className="fc-btn fc-btn--outline fc-btn--sm">
            Your orders
          </Link>
        }
      />
    )
  }

  const o = order.data
  const paid = o.paymentStatus === "CAPTURED" || o.paymentStatus === "PAID"
  return (
    <>
      <div className="fc-head">
        <div className="fc-row">
          <Link href="/feast/orders" className="fc-back" aria-label="Back to orders">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="fc-title">{o.restaurantName || "Your order"}</h1>
            <p className="fc-sub">
              {o.orderNumber}
              {o.placedAt ? ` · ${formatWhen(o.placedAt)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="fc-grid2">
        <div className="fc-stack">
          {o.status === "PAYMENT_PENDING" ? <PaymentPanel order={o} autoMethod={autoMethod} onAutoDone={clearParam} /> : null}
          {o.status !== "PAYMENT_PENDING" ? <Tracker order={o} /> : null}

          <section className="fc-card" aria-label="Dishes">
            <div className="fc-row">
              <Store size={16} aria-hidden="true" />
              <h2 className="fc-h2 fc-grow">Your food</h2>
            </div>
            {o.items.length ? (
              o.items.map((i) => (
                <div key={i.id || i.name} className="fc-row">
                  <VegMark foodType={i.foodType} />
                  <span className="fc-grow">
                    {i.quantity} × {i.name}
                  </span>
                  <span>{formatPaise(i.lineTotalPaise)}</span>
                </div>
              ))
            ) : (
              <p className="fc-note">Dish details aren&apos;t available for this order.</p>
            )}
          </section>

          {canCancel(o.status) ? (
            <section className="fc-card">
              {askCancel ? (
                <div className="fc-stack">
                  <p style={{ margin: 0 }}>Cancel this order? Nothing has been charged yet unless the payment is still confirming.</p>
                  <div className="fc-row">
                    <button
                      type="button"
                      className="fc-btn fc-btn--danger fc-btn--sm"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate({ id: o.id, reason: "changed my mind" }, { onSettled: () => setAskCancel(false) })}
                    >
                      {cancel.isPending ? "Cancelling…" : "Cancel order"}
                    </button>
                    <button type="button" className="fc-btn fc-btn--ghost fc-btn--sm" onClick={() => setAskCancel(false)}>
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="fc-btn fc-btn--ghost fc-btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setAskCancel(true)}>
                  Cancel order
                </button>
              )}
              {cancel.isError ? <p className="fc-alert" role="alert">{toFeastError(cancel.error).message}</p> : null}
            </section>
          ) : null}
        </div>

        <aside className="fc-stack fc-sticky">
          <section className="fc-card" aria-label="Bill">
            <h2 className="fc-h2">Bill</h2>
            {o.totalsPaise ? (
              <Bill totals={o.totalsPaise} breakdown={o.taxesAndCharges} />
            ) : o.finalAmountPaise !== null ? (
              <dl className="fc-bill">
                <div className="fc-bill__row fc-bill__row--total">
                  <dt>Total</dt>
                  <dd>{formatPaise(o.finalAmountPaise)}</dd>
                </div>
              </dl>
            ) : null}
            {paid ? (
              <p className="fc-ok fc-row">
                <CheckCircle2 size={14} aria-hidden="true" /> Paid online
              </p>
            ) : null}
          </section>

          <section className="fc-card" aria-labelledby="fc-invoice">
            <div className="fc-row">
              <FileText size={16} aria-hidden="true" />
              <h2 id="fc-invoice" className="fc-h2 fc-grow">Invoice</h2>
              <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" aria-expanded={invoiceOpen} onClick={() => setInvoiceOpen((v) => !v)}>
                {invoiceOpen ? "Hide" : "View"}
              </button>
            </div>
            {invoiceOpen ? <InvoiceView orderId={o.id} /> : null}
          </section>

          <Link href="/feast" className="fc-btn fc-btn--ghost fc-btn--sm">
            <MapPin size={14} aria-hidden="true" /> Order something else
          </Link>
        </aside>
      </div>
    </>
  )
}
