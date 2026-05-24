"use client"

// FiGo restaurant kitchen queue — partner-facing.
//
// Lists CONFIRMED orders awaiting the restaurant's accept, ordered by
// nearest-deadline first. Each row shows a live countdown until the
// SLA-breach auto-reject worker (B1) trips. Accept / reject inline.
//
// Two refresh paths run in parallel:
//   1. 5-second poll via useFoodKitchenQueue's refetchInterval — the
//      reconnect-recovery snapshot if SSE drops a frame or the gateway
//      flaps.
//   2. SSE on food.restaurant.{id}.orders via useFoodOrderStream —
//      sub-100ms invalidation on a new order / cancellation /
//      payment confirmation so the partner sees the row appear
//      without waiting on the poll.

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import {
  useFoodKitchenQueue,
  useFoodPartnerRestaurants,
  usePartnerAcceptOrder,
  usePartnerRejectOrder,
} from "@/hooks/useFoodAdmin"
import { useFoodOrderStream } from "@/hooks/useFoodOrderStream"

import { EmptyState, errorMessage } from "../../../admin/mopedu/_shared"

export default function KitchenQueuePage() {
  const restaurants = useFoodPartnerRestaurants()
  const list = restaurants.data ?? []
  const [restaurantId, setRestaurantId] = useState<string | undefined>(undefined)

  // Auto-select first restaurant on first load.
  useEffect(() => {
    if (!restaurantId && list.length > 0) {
      setRestaurantId(list[0].id)
    }
  }, [list, restaurantId])

  const queue = useFoodKitchenQueue(restaurantId)
  const accept = usePartnerAcceptOrder()
  const reject = usePartnerRejectOrder()
  const [reasons, setReasons] = useState<Record<string, string>>({})

  // SSE push: invalidate the kitchen query the moment a food.order.*
  // event lands. The query keys live under ['food','kitchen', id]
  // (see useFoodAdmin.ts) — invalidating that family triggers an
  // immediate refetch without disturbing the polling cadence.
  const qc = useQueryClient()
  useFoodOrderStream(restaurantId, () => {
    qc.invalidateQueries({ queryKey: ["food", "kitchen"] })
  })

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Kitchen queue</h1>
          <p className="text-sm text-slate-600">
            Orders awaiting your accept, sorted by SLA deadline.
          </p>
        </div>
        {list.length > 1 ? (
          <label className="flex flex-col text-xs text-slate-600">
            Restaurant
            <select
              value={restaurantId ?? ""}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              {list.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {restaurants.isLoading ? (
          <Loading label="Loading restaurants…" />
        ) : list.length === 0 ? (
          <EmptyState
            title="No restaurants"
            body="You don't own any restaurants yet."
          />
        ) : queue.isLoading ? (
          <Loading label="Loading kitchen queue…" />
        ) : queue.error ? (
          <p className="p-4 text-sm text-rose-700">
            {errorMessage(queue.error)}
          </p>
        ) : (queue.data ?? []).length === 0 ? (
          <EmptyState
            title="Inbox clear"
            body="No new orders waiting on you."
          />
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Placed</th>
                <th className="px-3 py-2">Deadline</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(queue.data ?? []).map((o) => {
                const reasonInput = reasons[o.id] ?? ""
                return (
                  <tr key={o.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <div className="font-medium">{o.order_number}</div>
                      {o.customer_instruction ? (
                        <div className="mt-1 max-w-xs text-xs text-slate-600">
                          “{o.customer_instruction}”
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{o.item_count}</td>
                    <td className="px-3 py-3">
                      {o.final_amount.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {new Date(o.placed_at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-3">
                      <Countdown seconds={o.seconds_to_breach} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={reasonInput}
                          onChange={(e) =>
                            setReasons((p) => ({
                              ...p,
                              [o.id]: e.target.value,
                            }))
                          }
                          placeholder="Reject reason"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => accept.mutate(o.id)}
                            disabled={accept.isPending}
                            className={[
                              "rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white",
                              accept.isPending
                                ? "cursor-wait opacity-60"
                                : "hover:bg-emerald-700",
                            ].join(" ")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              reject.mutate({
                                orderId: o.id,
                                reason: reasonInput,
                              })
                            }
                            disabled={reject.isPending}
                            className={[
                              "rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white",
                              reject.isPending
                                ? "cursor-wait opacity-60"
                                : "hover:bg-rose-700",
                            ].join(" ")}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {(accept.isError || reject.isError) ? (
        <p className="text-sm text-rose-700">
          {errorMessage(accept.error ?? reject.error)}
        </p>
      ) : null}
    </div>
  )
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center p-6 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

// Countdown takes the seconds_to_breach the backend returned (which is
// already clamped to 0) and ticks down locally between polls. Bumps
// the row color amber → red as the deadline approaches.
function Countdown({ seconds }: { seconds: number | null }) {
  const [tick, setTick] = useState(seconds ?? 0)
  useEffect(() => {
    setTick(seconds ?? 0)
  }, [seconds])
  useEffect(() => {
    if (tick <= 0) return
    const t = setInterval(() => setTick((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [tick])
  if (seconds == null) {
    return <span className="text-xs text-slate-500">no SLA</span>
  }
  if (tick === 0) {
    return (
      <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
        BREACHED
      </span>
    )
  }
  const tone =
    tick < 30
      ? "bg-rose-100 text-rose-800"
      : tick < 90
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-800"
  const mm = Math.floor(tick / 60)
  const ss = tick % 60
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {mm}:{ss.toString().padStart(2, "0")}
    </span>
  )
}
