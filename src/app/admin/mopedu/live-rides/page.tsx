"use client"

// Live rides — auto-refreshes every 10s via `useMopeduLiveRides`.
// Click a row to open the side panel with the ride status timeline + an
// admin "Cancel ride" override (reason required).

import { useMemo, useState } from "react"
import { Loader2, RefreshCw, X } from "lucide-react"

import {
  useCancelMopeduRide,
  useMopeduLiveRides,
  useMopeduRideDetail,
} from "@/hooks/useMopeduAdmin"
import type { MopeduLiveRide } from "@/types/mopedu"

import {
  ConfirmDialog,
  EmptyState,
  errorMessage,
  formatDate,
  MapPlaceholder,
  PrimaryButton,
  StatusPill,
  StatusTimeline,
  classNames,
  maskFirstName,
  maskPhone,
  paiseToRupees,
  relativeTime,
  shortId,
} from "../_shared"

function etaLabel(seconds: number | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "—"
  }
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`
}

export default function MopeduLiveRidesPage() {
  const live = useMopeduLiveRides()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const detail = useMopeduRideDetail(selectedId ?? undefined)
  const cancelM = useCancelMopeduRide()

  const items = useMemo<MopeduLiveRide[]>(
    () => live.data ?? [],
    [live.data],
  )

  const selected = useMemo(
    () => items.find((r) => r.id === selectedId) ?? null,
    [items, selectedId],
  )

  function handleCancelConfirm(reason: string) {
    if (!selectedId) return
    cancelM.mutate(
      { id: selectedId, reason },
      {
        onSuccess: () => {
          setConfirmCancel(false)
          setSelectedId(null)
        },
      },
    )
  }

  return (
    <div className="space-y-5">
      <MapPlaceholder
        title="Map view: Sprint 4 — see list below"
        body="Real-time pin map is on the roadmap; this page polls every 10s for now."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="overflow-hidden rounded-2xl border border-brand-divider bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-brand-text/70">
              Live rides
              <span className="ml-2 text-brand-text/40">
                {items.length} active · auto-refresh 10s
              </span>
            </p>
            <button
              type="button"
              onClick={() => void live.refetch()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-brand-text/70 hover:bg-gray-50"
              title="Refresh now"
            >
              <RefreshCw
                className={classNames(
                  "h-3 w-3",
                  live.isFetching && "animate-spin",
                )}
              />
              Refresh
            </button>
          </div>
          {live.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-brand-text/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : live.isError ? (
            <div className="px-4 py-6 text-sm text-rose-700">
              {errorMessage(live.error)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No live rides right now"
              body="When riders go on a trip, they'll show up here."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Ride</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Partner / Vehicle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={classNames(
                      "cursor-pointer transition-colors hover:bg-gray-50",
                      selectedId === r.id && "bg-blue-50/40",
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-brand-text">
                      {shortId(r.id)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {maskFirstName(r.customer_name)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium text-brand-text">
                        {maskFirstName(r.partner_name)}
                      </p>
                      <p className="text-brand-text/55">
                        {r.vehicle_number ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-brand-text/70">
                      {r.vehicle_type}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/55">
                      {relativeTime(r.started_at ?? r.requested_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {etaLabel(r.eta_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Side panel */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <div className="rounded-2xl border border-brand-divider bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                    Ride
                  </p>
                  <p className="mt-1 font-mono text-sm text-brand-text">
                    {shortId(selected.id, 12)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full p-1 text-brand-text/40 hover:bg-gray-100 hover:text-brand-text"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Status</dt>
                  <dd>
                    <StatusPill status={selected.status} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Customer</dt>
                  <dd>{maskFirstName(selected.customer_name)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Partner</dt>
                  <dd>
                    {maskFirstName(selected.partner_name)}{" "}
                    <span className="font-mono text-brand-text/40">
                      {maskPhone(selected.partner_phone)}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Vehicle</dt>
                  <dd>
                    {selected.vehicle_number ?? "—"}{" "}
                    <span className="capitalize text-brand-text/55">
                      ({selected.vehicle_type})
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Fare est.</dt>
                  <dd>{paiseToRupees(selected.fare_estimate_paise)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Started</dt>
                  <dd>{formatDate(selected.started_at)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">ETA</dt>
                  <dd>{etaLabel(selected.eta_seconds)}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                  Status timeline
                </p>
                {detail.isLoading ? (
                  <div className="flex items-center text-xs text-brand-text/55">
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </div>
                ) : detail.isError ? (
                  <p className="text-xs text-rose-700">
                    {errorMessage(detail.error)}
                  </p>
                ) : (
                  <StatusTimeline
                    events={detail.data?.status_history ?? []}
                  />
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <PrimaryButton
                  tone="red"
                  onClick={() => setConfirmCancel(true)}
                  disabled={
                    selected.status === "completed" ||
                    selected.status === "cancelled"
                  }
                >
                  Cancel ride
                </PrimaryButton>
              </div>

              {cancelM.isError ? (
                <p className="mt-2 text-xs text-rose-700">
                  {errorMessage(cancelM.error)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-xs text-brand-text/55">
              Pick a ride on the left to inspect it here.
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this ride?"
        description="This is an admin override. The customer and partner will be notified. Provide a reason for the audit log."
        confirmLabel={cancelM.isPending ? "Cancelling…" : "Cancel ride"}
        cancelLabel="Keep ride"
        tone="red"
        reasonRequired
        pending={cancelM.isPending}
        onConfirm={handleCancelConfirm}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  )
}
