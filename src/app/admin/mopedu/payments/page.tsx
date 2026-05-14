"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useMopeduPaymentsQueue,
  useRejectPayment,
  useVerifyPayment,
} from "@/hooks/useMopeduAdmin"
import type { PaymentQueueRow } from "@/lib/mopedu_api"

import {
  classNames,
  EmptyState,
  errorMessage,
  formatDate,
  paiseToRupees,
  PrimaryButton,
  ReasonInput,
  relativeTime,
  SecondaryButton,
  StatusPill,
  toneForStatus,
} from "../_shared"

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "failed", label: "Failed" },
]

function isImageUrl(url?: string): boolean {
  if (!url) return false
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url)
}

function PaymentCard({
  row,
  onVerify,
  onReject,
  busy,
}: {
  row: PaymentQueueRow
  onVerify: () => void
  onReject: (reason: string) => void
  busy: boolean
}) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState("")
  const canAct = row.status === "pending"

  return (
    <div className="rounded-2xl border border-brand-divider bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        {/* Proof preview */}
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          {row.payment_proof_url ? (
            isImageUrl(row.payment_proof_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <a
                href={row.payment_proof_url}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={row.payment_proof_url}
                  alt="payment proof"
                  className="h-full w-full object-cover"
                />
              </a>
            ) : (
              <a
                href={row.payment_proof_url}
                target="_blank"
                rel="noreferrer"
                className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-semibold text-brand-text/70 underline underline-offset-2"
              >
                Open file
              </a>
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-gray-400">
              No proof
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-lg font-bold text-brand-text">
              {paiseToRupees(row.amount_paise)}
            </p>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
              {row.payment_method}
            </span>
            <StatusPill
              status={row.status}
              tone={toneForStatus(row.status)}
            />
          </div>
          <p className="mt-1 text-sm font-medium text-brand-text">
            {row.partner_name ? (
              <Link
                href={`/admin/mopedu/partners/${row.partner_id}`}
                className="hover:underline"
              >
                {row.partner_name}
              </Link>
            ) : (
              "—"
            )}
          </p>
          <p className="text-xs text-brand-text/55">
            Plan: {row.plan_name ?? row.plan_id}
          </p>
          <p className="mt-1 text-[11px] text-brand-text/55">
            Submitted {formatDate(row.submitted_at)} ·{" "}
            {relativeTime(row.submitted_at)}
          </p>
          {row.verified_at ? (
            <p className="text-[11px] text-emerald-700">
              Verified {formatDate(row.verified_at)}
            </p>
          ) : null}
        </div>

        {/* Actions */}
        {canAct ? (
          <div className="ml-auto flex flex-col items-end gap-2">
            {showRejectForm ? (
              <div className="w-64">
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
                    disabled={!reason.trim() || busy}
                    onClick={() => {
                      onReject(reason.trim())
                      setShowRejectForm(false)
                      setReason("")
                    }}
                  >
                    Reject
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <PrimaryButton
                  tone="red"
                  onClick={() => setShowRejectForm(true)}
                  disabled={busy}
                >
                  Reject
                </PrimaryButton>
                <PrimaryButton
                  tone="green"
                  onClick={onVerify}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Verify
                </PrimaryButton>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Next.js 14+ requires that any component reading useSearchParams sit
// inside a Suspense boundary, otherwise `next build` fails the static
// prerender pass with "useSearchParams() should be wrapped in a
// suspense boundary". Splitting the content into a separate function
// and wrapping it in <Suspense> is the upstream-recommended fix.
function MopeduPaymentsQueueContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams?.get("status") ?? "pending"

  const params = useMemo(
    () => ({ status, limit: 50, offset: 0 }),
    [status],
  )

  const list = useMopeduPaymentsQueue(params)
  const verifyM = useVerifyPayment()
  const rejectM = useRejectPayment()

  function setStatus(next: string) {
    const p = new URLSearchParams(searchParams?.toString() ?? "")
    p.set("status", next)
    router.push(`/admin/mopedu/payments?${p.toString()}`)
  }

  const items = list.data?.items ?? []
  const verifyingId =
    verifyM.isPending && typeof verifyM.variables === "string"
      ? verifyM.variables
      : null
  const rejectingId =
    rejectM.isPending && rejectM.variables ? rejectM.variables.id : null

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

      {list.isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-brand-divider bg-white py-12 text-sm text-brand-text/60 shadow-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading payments…
        </div>
      ) : list.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage(list.error)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No payments to review"
          body="Subscription proofs awaiting verification will appear here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <PaymentCard
              key={row.id}
              row={row}
              onVerify={() => verifyM.mutate(row.id)}
              onReject={(reason) =>
                rejectM.mutate({ id: row.id, reason })
              }
              busy={verifyingId === row.id || rejectingId === row.id}
            />
          ))}
        </div>
      )}

      {(verifyM.isError || rejectM.isError) && (
        <p className="text-xs text-rose-700">
          {errorMessage(verifyM.error ?? rejectM.error)}
        </p>
      )}
    </div>
  )
}

export default function MopeduPaymentsQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading payments queue…
        </div>
      }
    >
      <MopeduPaymentsQueueContent />
    </Suspense>
  )
}
