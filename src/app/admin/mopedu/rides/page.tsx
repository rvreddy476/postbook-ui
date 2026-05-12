"use client"

// Ride history — paged search across all rides. Filters: status, free-text
// (ride id / partner phone), date range. Click a row to open a detail modal
// with the full ride record + status timeline.

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useMopeduRideDetail,
  useMopeduRides,
} from "@/hooks/useMopeduAdmin"
import type { RideHistoryRow } from "@/lib/mopedu_api"

import {
  EmptyState,
  Modal,
  Pagination,
  StatusPill,
  StatusTimeline,
  classNames,
  errorMessage,
  formatDate,
  maskFirstName,
  maskPhone,
  paiseToRupees,
  shortId,
} from "../_shared"

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "no_show", label: "No-show" },
  { key: "in_progress", label: "In progress" },
]

const PAGE_SIZE = 25

export default function MopeduRidesHistoryPage() {
  const [status, setStatus] = useState<string>("all")
  const [q, setQ] = useState<string>("")
  const [start, setStart] = useState<string>("")
  const [end, setEnd] = useState<string>("")
  const [offset, setOffset] = useState<number>(0)
  const [pendingQ, setPendingQ] = useState<string>("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const params = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      q: q || undefined,
      start: start || undefined,
      end: end || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [status, q, start, end, offset],
  )

  const list = useMopeduRides(params)
  const detail = useMopeduRideDetail(selectedId ?? undefined)

  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0

  function applySearch(e: React.FormEvent) {
    e.preventDefault()
    setQ(pendingQ.trim())
    setOffset(0)
  }

  function setStatusAndReset(next: string) {
    setStatus(next)
    setOffset(0)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand-divider bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusAndReset(f.key)}
                className={classNames(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-brand-text bg-brand-text text-white"
                    : "border-gray-300 bg-white text-brand-text/70 hover:bg-gray-50",
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <form
          onSubmit={applySearch}
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
        >
          <input
            type="text"
            value={pendingQ}
            onChange={(e) => setPendingQ(e.target.value)}
            placeholder="Ride id or partner phone"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value)
              setOffset(0)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
          <input
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
              setOffset(0)
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-text"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-text px-4 py-2 text-sm font-semibold text-white hover:bg-brand-text/90"
          >
            Search
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-divider bg-white shadow-sm">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-brand-text/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : list.isError ? (
          <div className="px-4 py-6 text-sm text-rose-700">
            {errorMessage(list.error)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No rides match"
            body="Try widening the date range or clearing filters."
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Ride</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Estimate</th>
                  <th className="px-4 py-3">Final</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((r: RideHistoryRow) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-brand-text">
                      {shortId(r.id)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {maskFirstName(r.customer_name)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p>{maskFirstName(r.partner_name)}</p>
                      <p className="font-mono text-[11px] text-brand-text/45">
                        {maskPhone(r.partner_phone)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-brand-text/70">
                      {r.vehicle_type}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {paiseToRupees(r.fare_estimate_paise)}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {paiseToRupees(r.final_fare_paise)}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/55">
                      {formatDate(r.requested_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              total={total}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={setOffset}
            />
          </>
        )}
      </div>

      <Modal
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title="Ride detail"
        width="lg"
      >
        {detail.isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-brand-text/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : detail.isError ? (
          <p className="text-sm text-rose-700">
            {errorMessage(detail.error)}
          </p>
        ) : detail.data ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                Ride
              </p>
              <dl className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">ID</dt>
                  <dd className="font-mono">
                    {shortId(detail.data.ride.id, 16)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Status</dt>
                  <dd>
                    <StatusPill status={detail.data.ride.status} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Vehicle type</dt>
                  <dd className="capitalize">
                    {detail.data.ride.vehicle_type}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Customer</dt>
                  <dd>{maskFirstName(detail.data.customer_name)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Partner</dt>
                  <dd>
                    {maskFirstName(detail.data.partner_name)}{" "}
                    <span className="font-mono text-brand-text/45">
                      {maskPhone(detail.data.partner_phone)}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Vehicle</dt>
                  <dd>{detail.data.vehicle_number ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Payment</dt>
                  <dd className="capitalize">
                    {detail.data.ride.payment_method}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Estimate</dt>
                  <dd>{paiseToRupees(detail.data.ride.fare_estimate_paise)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Final fare</dt>
                  <dd>{paiseToRupees(detail.data.ride.final_fare_paise)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Requested</dt>
                  <dd>{formatDate(detail.data.ride.requested_at)}</dd>
                </div>
                {detail.data.ride.completed_at ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-brand-text/60">Completed</dt>
                    <dd>{formatDate(detail.data.ride.completed_at)}</dd>
                  </div>
                ) : null}
              </dl>

              <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                Pickup
              </p>
              <p className="mt-1 text-xs text-brand-text/80">
                {detail.data.ride.pickup.address ?? "—"}
              </p>
              <p className="text-[11px] text-brand-text/45">
                {detail.data.ride.pickup.lat.toFixed(5)},{" "}
                {detail.data.ride.pickup.lng.toFixed(5)}
              </p>

              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                Drop
              </p>
              <p className="mt-1 text-xs text-brand-text/80">
                {detail.data.ride.drop.address ?? "—"}
              </p>
              <p className="text-[11px] text-brand-text/45">
                {detail.data.ride.drop.lat.toFixed(5)},{" "}
                {detail.data.ride.drop.lng.toFixed(5)}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                Status history
              </p>
              <div className="mt-2">
                <StatusTimeline events={detail.data.status_history ?? []} />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
