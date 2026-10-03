"use client"

/*
  The live order board: New (CONFIRMED, with the accept countdown),
  Preparing, and Ready / awaiting pickup (rider's pickup code).

  - Accept/reject/ready carry an Idempotency-Key per (order, action). The key
    is kept when the outcome is unknown (no answer, 5xx) so the retry is the
    same request; a definite answer drops it.
  - Past the deadline accept is refused here; the server auto-rejects.
  - The sound loops while a new order is unacknowledged, only after the
    partner turned it on (a browser needs that click), and can be muted.
*/

import { BellOff, BellRing, Radio, RefreshCw, Volume2, VolumeX } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { fetchOrder, transitionOrder } from "../../api/client"
import { acceptWindow, canRespond, deadlineOf, formatRemaining } from "../../model/countdown"
import { createActionKeys } from "../../model/actionKeys"
import { isStaleTransition, kitchenMessage, toFailure, type ApiFailure } from "../../model/errors"
import { formatPaise } from "../../model/money"
import { AWAITING_PICKUP, orderStatusLabel, orderStatusTone, REJECT_REASONS, type OrderAction } from "../../model/orders"
import type { PartnerOrder, QueueOrder } from "../../model/wire"
import { useKitchenQueue, useNow } from "../../hooks/useKitchenQueue"
import { useOrderAlert } from "../../hooks/useOrderAlert"
import { Dialog, FailureNotice, Notice, Pill, formatTime } from "../ui"
import { PickupCode } from "./PickupCode"

export function OrderBoard({ restaurantId, onNewCount }: { restaurantId: string; onNewCount?: (n: number) => void }) {
  const board = useKitchenQueue(restaurantId)
  const now = useNow()
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Record<string, PartnerOrder>>({})
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ tone: "danger" | "success" | "info"; text: string } | null>(null)
  const [rejecting, setRejecting] = useState<QueueOrder | null>(null)
  const keys = useRef(createActionKeys())

  const windows = useMemo(
    () => new Map(board.queue.map((o) => [o.id, acceptWindow(deadlineOf(o, board.fetchedAt), now)])),
    [board.queue, board.fetchedAt, now],
  )

  const unacknowledged = board.queue.filter((o) => !acknowledged.has(o.id) && canRespond(windows.get(o.id) ?? { kind: "no-deadline" })).length
  const alert = useOrderAlert(unacknowledged)

  useEffect(() => onNewCount?.(board.queue.length), [board.queue.length, onNewCount])

  // Lines for new orders: the queue row carries only a count.
  const requested = useRef(new Set<string>())
  useEffect(() => {
    for (const o of board.queue) {
      if (requested.current.has(o.id)) continue
      requested.current.add(o.id)
      fetchOrder(o.id)
        .then((d) => setDetails((m) => ({ ...m, [o.id]: d })))
        // Let the next queue refresh try again.
        .catch(() => requested.current.delete(o.id))
    }
  }, [board.queue])

  const act = useCallback(
    async (orderId: string, action: OrderAction, reason?: string) => {
      if (busy.has(orderId)) return
      setBusy((b) => new Set(b).add(orderId))
      setMessage(null)
      const key = keys.current.keyFor(orderId, action)
      try {
        await transitionOrder(orderId, action, key, reason)
        keys.current.settle(orderId, action, false)
        setAcknowledged((a) => new Set(a).add(orderId))
        setMessage({ tone: "success", text: action === "reject" ? "Order rejected." : action === "mark-ready" ? "Marked ready. A rider is being found." : "Accepted. Start preparing." })
      } catch (e) {
        const f: ApiFailure = toFailure(e)
        keys.current.settle(orderId, action, f.outcomeUnknown)
        setMessage({ tone: isStaleTransition(f) ? "info" : "danger", text: f.outcomeUnknown ? `${kitchenMessage(f)} Press again to retry the same action.` : kitchenMessage(f) })
      } finally {
        setBusy((b) => {
          const n = new Set(b)
          n.delete(orderId)
          return n
        })
        void board.refresh()
      }
    },
    [busy, board],
  )

  const preparing = board.active.filter((o) => o.status === "PREPARING")
  const awaiting = board.active.filter((o) => AWAITING_PICKUP.has(o.status))

  return (
    <div className="kit-form" style={{ gap: 12 }}>
      <div className="kit-row kit-row--between">
        <div className="kit-row">
          <Pill tone={board.transport === "live" ? "positive" : "neutral"}>
            <Radio size={11} aria-hidden /> {board.transport === "live" ? "Live" : board.transport === "connecting" ? "Connecting…" : "Refreshing every 15 s"}
          </Pill>
          <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={() => void board.refresh()}>
            <RefreshCw size={13} aria-hidden /> Refresh
          </button>
        </div>
        <div className="kit-row">
          {!alert.unlocked ? (
            <button type="button" className="kit-btn kit-btn--outline kit-btn--sm" onClick={alert.unlock}>
              <BellRing size={14} aria-hidden /> Turn on order sound
            </button>
          ) : (
            <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={alert.toggleMute} aria-pressed={alert.muted}>
              {alert.muted ? <VolumeX size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />} {alert.muted ? "Sound muted" : "Sound on"}
            </button>
          )}
          {alert.ringing ? (
            <button type="button" className="kit-btn kit-btn--outline kit-btn--sm" onClick={() => setAcknowledged((a) => new Set([...a, ...board.queue.map((o) => o.id)]))}>
              <BellOff size={14} aria-hidden /> Silence
            </button>
          ) : null}
        </div>
      </div>

      {!alert.unlocked ? <Notice tone="warning">Browsers block sound until you click. Turn on the order sound so new orders ring.</Notice> : null}
      <FailureNotice failure={board.error} />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <div className="kit-grid kit-grid--board">
        <section aria-label="New orders">
          <h2 className="kit-col__head">
            New <span>{board.queue.length}</span>
          </h2>
          {board.loaded && board.queue.length === 0 ? <div className="kit-empty">No new orders.</div> : null}
          {board.queue.map((o) => {
            const w = windows.get(o.id) ?? { kind: "no-deadline" as const }
            const d = details[o.id]
            const open = canRespond(w)
            return (
              <article
                key={o.id}
                className={`kit-ticket ${w.kind === "open" && w.urgent ? "kit-ticket--urgent" : open ? "kit-ticket--new" : ""}`}
                onClick={() => setAcknowledged((a) => (a.has(o.id) ? a : new Set(a).add(o.id)))}
              >
                <div className="kit-ticket__head">
                  <span className="kit-ticket__num">#{o.orderNumber.slice(-6)}</span>
                  {w.kind === "open" ? (
                    <span className={`kit-timer${w.urgent ? " kit-timer--urgent" : ""}`} aria-label={`${w.remainingSeconds} seconds left to accept`}>
                      {formatRemaining(w.remainingSeconds)}
                    </span>
                  ) : w.kind === "expired" ? (
                    <span className="kit-timer kit-timer--expired">Time&apos;s up — Feast will cancel it</span>
                  ) : null}
                </div>
                <div className="kit-meta">
                  {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {formatPaise(o.finalAmountPaise)} · placed {formatTime(o.placedAt)}
                  {d ? ` · ${d.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"}` : ""}
                </div>
                {d ? <Lines order={d} /> : <p className="kit-small">Loading items…</p>}
                {o.customerInstruction ? <div className="kit-ticket__note">Note: {o.customerInstruction}</div> : null}
                <div className="kit-row">
                  <button type="button" className="kit-btn kit-btn--go" disabled={!open || busy.has(o.id)} onClick={() => void act(o.id, "accept")}>
                    Accept
                  </button>
                  <button type="button" className="kit-btn kit-btn--danger" disabled={!open || busy.has(o.id)} onClick={() => setRejecting(o)}>
                    Reject
                  </button>
                </div>
              </article>
            )
          })}
        </section>

        <section aria-label="Preparing">
          <h2 className="kit-col__head">
            Preparing <span>{preparing.length}</span>
          </h2>
          {board.loaded && preparing.length === 0 ? <div className="kit-empty">Nothing on the stove.</div> : null}
          {preparing.map((o) => (
            <article key={o.id} className="kit-ticket">
              <TicketHead order={o} />
              <Lines order={o} />
              <button type="button" className="kit-btn kit-btn--primary" disabled={busy.has(o.id)} onClick={() => void act(o.id, "mark-ready")}>
                Mark ready for pickup
              </button>
            </article>
          ))}
        </section>

        <section aria-label="Ready for pickup">
          <h2 className="kit-col__head">
            Ready / pickup <span>{awaiting.length}</span>
          </h2>
          {board.loaded && awaiting.length === 0 ? <div className="kit-empty">Nothing waiting for a rider.</div> : null}
          {awaiting.map((o) => (
            <article key={o.id} className="kit-ticket">
              <TicketHead order={o} />
              <Lines order={o} />
              <PickupCode orderId={o.id} onVerified={() => void board.refresh()} />
            </article>
          ))}
        </section>
      </div>

      {rejecting ? (
        <RejectDialog
          order={rejecting}
          onClose={() => setRejecting(null)}
          onReject={async (reason) => {
            setRejecting(null)
            await act(rejecting.id, "reject", reason)
          }}
        />
      ) : null}
    </div>
  )
}

function TicketHead({ order }: { order: PartnerOrder }) {
  return (
    <>
      <div className="kit-ticket__head">
        <span className="kit-ticket__num">#{order.orderNumber.slice(-6)}</span>
        <Pill tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Pill>
      </div>
      <div className="kit-meta">
        {formatPaise(order.finalAmountPaise)} · placed {formatTime(order.placedAt)}
        {order.estimatedPreparationMinutes ? ` · ~${order.estimatedPreparationMinutes} min` : ""}
      </div>
    </>
  )
}

function Lines({ order }: { order: PartnerOrder }) {
  return (
    <ul className="kit-ticket__lines">
      {order.items.map((l) => (
        <li key={l.id} className="kit-ticket__line">
          <span>
            <strong>{l.quantity} ×</strong> {l.name}
            {l.instruction ? <span className="kit-small"> — {l.instruction}</span> : null}
          </span>
          <span className="kit-num kit-small">{formatPaise(l.lineTotalPaise)}</span>
        </li>
      ))}
    </ul>
  )
}

function RejectDialog({ order, onClose, onReject }: { order: QueueOrder; onClose: () => void; onReject: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("")
  const [other, setOther] = useState("")
  const finalReason = reason === "Other" ? other.trim() : reason
  return (
    <Dialog title={`Reject order #${order.orderNumber.slice(-6)}?`} onClose={onClose}>
      <div className="kit-form">
        <p className="kit-meta" style={{ margin: 0 }}>
          The customer is told and any online payment is refunded. Rejections count against your restaurant&apos;s rating.
        </p>
        <select className="kit-select" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Choose a reason…</option>
          {REJECT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {reason === "Other" ? <input className="kit-input" placeholder="Reason" aria-label="Other reason" value={other} onChange={(e) => setOther(e.target.value)} maxLength={200} /> : null}
        <div className="kit-row kit-row--end">
          <button type="button" className="kit-btn kit-btn--ghost" onClick={onClose}>
            Keep order
          </button>
          <button type="button" className="kit-btn kit-btn--danger" disabled={!finalReason} onClick={() => void onReject(finalReason)}>
            Reject order
          </button>
        </div>
      </div>
    </Dialog>
  )
}

