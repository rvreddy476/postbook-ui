"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

const ADMIN_HEADERS = { "X-Scopes": "admin superadmin moderator" } as const

interface ProductQueueRow {
  id: string
  seller_id: string
  title: string
  status: string
  approval_status: string
  created_at: string
}

interface QueueResponse {
  products: ProductQueueRow[]
  total: number
}

export default function AdminProductQueuePage() {
  const qc = useQueryClient()
  const [actionFor, setActionFor] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [reason, setReason] = useState("")

  const { data, isLoading, error } = useQuery<QueueResponse>({
    queryKey: ["admin", "commerce", "products", "queue"],
    queryFn: async () =>
      (await api.get("/v1/commerce/internal/products/queue", { headers: ADMIN_HEADERS })).data.data,
  })

  const reset = () => {
    setActionFor(null)
    setNotes("")
    setReason("")
  }

  const approve = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) =>
      api.post(
        `/v1/commerce/internal/products/${id}/approve`,
        { notes },
        { headers: ADMIN_HEADERS },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "commerce", "products", "queue"] })
      reset()
    },
  })

  const reject = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes: string }) =>
      api.post(
        `/v1/commerce/internal/products/${id}/reject`,
        { reason, notes },
        { headers: ADMIN_HEADERS },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "commerce", "products", "queue"] })
      reset()
    },
  })

  const products = data?.products ?? []

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Product Approval Queue</h1>
      <p className="mt-1 text-sm text-gray-600">
        Products submitted by sellers awaiting moderator review. Approving makes them visible in
        the customer catalog; rejecting requires a reason that the seller will see.
      </p>

      {isLoading ? (
        <div className="mt-8 text-sm text-gray-500">Loading…</div>
      ) : error ? (
        <div className="mt-8 text-sm text-red-600">{(error as Error).message}</div>
      ) : products.length === 0 ? (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nothing pending. Newly submitted products will appear here.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {p.seller_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {p.approval_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setActionFor(p.id)}
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
            <h2 className="text-lg font-semibold">Review product</h2>

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
                  placeholder="Shown to seller — required if rejecting"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => reset()}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
              >
                Cancel
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
