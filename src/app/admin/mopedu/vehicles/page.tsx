"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"

import {
  useMopeduVehiclesQueue,
  useRejectVehicle,
  useVerifyVehicle,
} from "@/hooks/useMopeduAdmin"
import type { VehicleQueueRow } from "@/lib/mopedu_api"

import {
  classNames,
  EmptyState,
  errorMessage,
  formatDate,
  PrimaryButton,
  ReasonInput,
  relativeTime,
  SecondaryButton,
  StatusPill,
  toneForStatus,
} from "../_shared"

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
]

export default function MopeduVehiclesQueuePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams?.get("status") ?? "pending"

  const params = useMemo(
    () => ({ status, limit: 50, offset: 0 }),
    [status],
  )

  const list = useMopeduVehiclesQueue(params)
  const verifyM = useVerifyVehicle()
  const rejectM = useRejectVehicle()

  const [selected, setSelected] = useState<VehicleQueueRow | null>(null)
  const [reason, setReason] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)

  function setStatus(next: string) {
    const p = new URLSearchParams(searchParams?.toString() ?? "")
    p.set("status", next)
    router.push(`/admin/mopedu/vehicles?${p.toString()}`)
    setSelected(null)
  }

  function closePanel() {
    setSelected(null)
    setReason("")
    setShowRejectForm(false)
  }

  async function handleVerify() {
    if (!selected) return
    await verifyM.mutateAsync(selected.id)
    closePanel()
  }

  async function handleReject() {
    if (!selected) return
    const r = reason.trim().slice(0, 200)
    if (!r) return
    await rejectM.mutateAsync({ id: selected.id, reason: r })
    closePanel()
  }

  const items = list.data?.items ?? []

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
                onClick={() => setStatus(f.key)}
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
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
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
              title="Queue is empty"
              body="No vehicles matching this filter."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reg #</th>
                  <th className="px-4 py-3">KYC</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((v) => (
                  <tr
                    key={v.id}
                    className={classNames(
                      "cursor-pointer transition-colors hover:bg-gray-50",
                      selected?.id === v.id && "bg-blue-50/40",
                    )}
                    onClick={() => {
                      setSelected(v)
                      setShowRejectForm(false)
                      setReason("")
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {v.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.thumbnail_url}
                            alt={`${v.make} ${v.model}`}
                            className="h-12 w-16 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-16 items-center justify-center rounded-md bg-gray-100 text-[10px] text-gray-400">
                            No photo
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-brand-text">
                            {v.make} {v.model}
                          </p>
                          <p className="text-[11px] text-brand-text/55">
                            {v.year} · {v.color}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {v.partner_name ? (
                        <Link
                          href={`/admin/mopedu/partners/${v.partner_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {v.partner_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/70">
                      {v.vehicle_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-text/70">
                      {v.registration_number}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        status={v.kyc_status}
                        tone={toneForStatus(v.kyc_status)}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-text/55">
                      {relativeTime(v.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-semibold text-brand-text/60 underline underline-offset-2">
                        Open
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <div className="rounded-2xl border border-brand-divider bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                    Vehicle
                  </p>
                  <p className="mt-1 text-sm font-semibold text-brand-text">
                    {selected.make} {selected.model} ({selected.year})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-full p-1 text-brand-text/40 hover:bg-gray-100 hover:text-brand-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                {selected.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.thumbnail_url}
                    alt={`${selected.make} ${selected.model}`}
                    className="max-h-64 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-gray-500">
                    No photo
                  </div>
                )}
              </div>

              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Type</dt>
                  <dd className="capitalize">{selected.vehicle_type}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Reg #</dt>
                  <dd className="font-mono">{selected.registration_number}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Color</dt>
                  <dd>{selected.color}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Status</dt>
                  <dd>
                    <StatusPill
                      status={selected.status}
                      tone={toneForStatus(selected.status)}
                    />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">KYC</dt>
                  <dd>
                    <StatusPill
                      status={selected.kyc_status}
                      tone={toneForStatus(selected.kyc_status)}
                    />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-text/60">Submitted</dt>
                  <dd>{formatDate(selected.created_at)}</dd>
                </div>
              </dl>

              {selected.partner_id ? (
                <Link
                  href={`/admin/mopedu/partners/${selected.partner_id}`}
                  className="mt-3 block text-xs font-semibold text-brand-text/70 underline underline-offset-2 hover:text-brand-text"
                >
                  View partner profile →
                </Link>
              ) : null}

              {selected.status === "pending" ? (
                showRejectForm ? (
                  <div className="mt-3">
                    <ReasonInput value={reason} onChange={setReason} />
                    <div className="mt-2 flex justify-end gap-2">
                      <SecondaryButton
                        onClick={() => {
                          setShowRejectForm(false)
                          setReason("")
                        }}
                      >
                        Cancel
                      </SecondaryButton>
                      <PrimaryButton
                        tone="red"
                        disabled={!reason.trim() || rejectM.isPending}
                        onClick={() => void handleReject()}
                      >
                        Reject
                      </PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex justify-end gap-2">
                    <PrimaryButton
                      tone="red"
                      onClick={() => setShowRejectForm(true)}
                    >
                      Reject
                    </PrimaryButton>
                    <PrimaryButton
                      tone="green"
                      disabled={verifyM.isPending}
                      onClick={() => void handleVerify()}
                    >
                      {verifyM.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Verify
                    </PrimaryButton>
                  </div>
                )
              ) : null}

              {(verifyM.isError || rejectM.isError) && (
                <p className="mt-2 text-xs text-rose-700">
                  {errorMessage(verifyM.error ?? rejectM.error)}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-xs text-brand-text/55">
              Pick a vehicle on the left to preview it here.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
