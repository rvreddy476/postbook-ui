"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

interface KYCCheck {
  field: string
  status: "valid" | "invalid" | "skipped"
  message?: string
  source: string
}
interface KYCReport {
  checks: KYCCheck[]
  all_valid: boolean
}

// X-Scopes is the same admin gate the existing /admin page uses; the
// commerce-service doesn't enforce a role itself but the gateway does.
const ADMIN_HEADERS = { "X-Scopes": "admin superadmin moderator" } as const

interface SellerQueueRow {
  id: string
  user_id: string
  store_name: string
  email: string
  status: string
  verification_status: string
  created_at: string
  onboarding_step?: number
}

interface QueueResponse {
  sellers: SellerQueueRow[]
  total: number
}

export default function AdminSellerQueuePage() {
  const qc = useQueryClient()
  const [actionFor, setActionFor] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [reason, setReason] = useState("")
  const [changes, setChanges] = useState("")

  const { data, isLoading, error } = useQuery<QueueResponse>({
    queryKey: ["admin", "commerce", "sellers", "queue"],
    queryFn: async () =>
      (await api.get("/v1/commerce/internal/sellers/queue", { headers: ADMIN_HEADERS })).data.data,
  })

  const reset = () => {
    setActionFor(null)
    setNotes("")
    setReason("")
    setChanges("")
  }

  const approve = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) =>
      api.post(
        `/v1/commerce/internal/sellers/${id}/approve`,
        { notes },
        { headers: ADMIN_HEADERS },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "commerce", "sellers", "queue"] })
      reset()
    },
  })

  const reject = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes: string }) =>
      api.post(
        `/v1/commerce/internal/sellers/${id}/reject`,
        { reason, notes },
        { headers: ADMIN_HEADERS },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "commerce", "sellers", "queue"] })
      reset()
    },
  })

  const requestChanges = useMutation({
    mutationFn: async ({ id, changes, notes }: { id: string; changes: string; notes: string }) =>
      api.post(
        `/v1/commerce/internal/sellers/${id}/request-changes`,
        { changes, notes },
        { headers: ADMIN_HEADERS },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "commerce", "sellers", "queue"] })
      reset()
    },
  })

  // Phase 3.2 — run the configured KYC adapter against the seller's GSTIN /
  // PAN / bank / UPI. The verdict updates verification_status server-side;
  // the per-field report is shown inline so the admin can spot a "stub"
  // source and refuse to approve without a production adapter.
  const [kycReport, setKycReport] = useState<KYCReport | null>(null)
  const [kycError, setKycError] = useState<string | null>(null)
  const verifyKYC = useMutation({
    mutationFn: async (id: string): Promise<KYCReport> =>
      (await api.post(`/v1/commerce/internal/sellers/${id}/kyc/verify`, {}, { headers: ADMIN_HEADERS }))
        .data.data,
    onSuccess: (rep) => {
      setKycReport(rep)
      setKycError(null)
      qc.invalidateQueries({ queryKey: ["admin", "commerce", "sellers", "queue"] })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "KYC verification failed"
      setKycReport(null)
      setKycError(message)
    },
  })

  useEffect(() => {
    setKycReport(null)
    setKycError(null)
  }, [actionFor])

  const sellers = data?.sellers ?? []

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Seller Approval Queue</h1>
      <p className="mt-1 text-sm text-gray-600">
        Sellers awaiting onboarding review. Approve to publish their store, request changes for
        missing KYC docs, or reject with a reason.
      </p>

      {isLoading ? (
        <div className="mt-8 text-sm text-gray-500">Loading…</div>
      ) : error ? (
        <div className="mt-8 text-sm text-red-600">{(error as Error).message}</div>
      ) : sellers.length === 0 ? (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nothing pending. New onboardings will show up here.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sellers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.store_name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {s.status || "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.verification_status || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setActionFor(s.id)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-100"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => reset()}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Review seller</h2>

            {/* KYC verification panel */}
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                    KYC verification
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Runs GSTIN / PAN / bank / UPI checks via the configured adapter.
                  </p>
                </div>
                <button
                  onClick={() => actionFor && verifyKYC.mutate(actionFor)}
                  disabled={verifyKYC.isPending}
                  className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-40"
                >
                  {verifyKYC.isPending ? "Running…" : "Run KYC"}
                </button>
              </div>
              {kycError && (
                <p className="mt-2 text-xs text-red-600">{kycError}</p>
              )}
              {kycReport && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-xs">
                    Verdict:{" "}
                    <span
                      className={`font-bold ${kycReport.all_valid ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {kycReport.all_valid ? "ALL VALID" : "INCOMPLETE"}
                    </span>
                  </div>
                  {kycReport.checks.some((c) => c.source === "stub") && (
                    <p className="text-[11px] text-amber-700">
                      ⚠ At least one check used the <span className="font-mono">stub</span> adapter
                      — format-only verification, no issuer lookup. Do not approve as fully
                      verified.
                    </p>
                  )}
                  <ul className="text-xs space-y-0.5">
                    {kycReport.checks.map((c) => (
                      <li key={c.field} className="flex items-center gap-2">
                        <span className="font-mono uppercase text-gray-500 w-24">{c.field}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            c.status === "valid"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.status === "invalid"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {c.status}
                        </span>
                        <span className="text-gray-500">({c.source})</span>
                        {c.message && (
                          <span className="text-gray-400 truncate">— {c.message}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Internal notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Visible to admins only"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-gray-600">Reject reason</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Required if rejecting"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-gray-600">Requested changes</span>
                <input
                  value={changes}
                  onChange={(e) => setChanges(e.target.value)}
                  placeholder='e.g. "Missing GST certificate; please upload"'
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => reset()}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                disabled={!changes || requestChanges.isPending}
                onClick={() =>
                  actionFor && requestChanges.mutate({ id: actionFor, changes, notes })
                }
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
              >
                Request changes
              </button>
              <button
                disabled={!reason || reject.isPending}
                onClick={() => actionFor && reject.mutate({ id: actionFor, reason, notes })}
                className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-40"
              >
                Reject
              </button>
              <button
                disabled={approve.isPending}
                onClick={() => actionFor && approve.mutate({ id: actionFor, notes })}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
