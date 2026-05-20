"use client"

import { useEffect, useState } from "react"
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

interface ProductDetail {
  id: string
  title: string
  short_description?: string | null
  description?: string | null
  brand_name?: string | null
  manufacturer_name?: string | null
  hsn_code?: string | null
  country_of_origin?: string | null
  warranty_info?: string | null
  return_policy_type?: string | null
  return_policy_days?: number | null
  weight_grams?: number | null
  length_cm?: number | null
  width_cm?: number | null
  height_cm?: number | null
  primary_image_media_id?: string | null
  video_media_id?: string | null
  search_keywords?: string[] | null
}

interface ProductMedia {
  id: string
  media_id: string
  media_type: string
  sort_order: number
}

interface ProductAttribute {
  name: string
  value: string
  unit?: string | null
}

// useProductDetail fetches the catalog row + variants for the admin modal.
// Pending products are still readable on the public endpoint — the customer
// catalog filter happens in ListProducts, not GetProductByID. (Phase 3.4)
function useProductDetail(productId: string | null) {
  return useQuery<{ product: ProductDetail }>({
    queryKey: ["admin", "commerce", "product", productId],
    enabled: !!productId,
    queryFn: async () =>
      (await api.get(`/v1/commerce/products/${productId}`, { headers: ADMIN_HEADERS })).data.data,
  })
}

function useProductMedia(productId: string | null) {
  return useQuery<ProductMedia[]>({
    queryKey: ["admin", "commerce", "product", productId, "media"],
    enabled: !!productId,
    queryFn: async () =>
      (await api.get(`/v1/commerce/products/${productId}/media`, { headers: ADMIN_HEADERS })).data
        .data?.media ?? [],
  })
}

function useProductAttrs(productId: string | null) {
  return useQuery<ProductAttribute[]>({
    queryKey: ["admin", "commerce", "product", productId, "attrs"],
    enabled: !!productId,
    queryFn: async () =>
      (await api.get(`/v1/commerce/products/${productId}/attributes`, { headers: ADMIN_HEADERS }))
        .data.data?.attributes ?? [],
  })
}

function MediaThumb({ mediaId }: { mediaId: string }) {
  // Reuse the standard media-service URL. The admin UI doesn't need a
  // presigned URL — it has cookie auth via api-gateway.
  return (
    <img
      src={`/api/v1/media/${mediaId}/download`}
      alt=""
      className="w-20 h-20 object-cover rounded-md border border-gray-200 bg-gray-50"
    />
  )
}

export default function AdminProductQueuePage() {
  const qc = useQueryClient()
  const [actionFor, setActionFor] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [reason, setReason] = useState("")
  const [changesMessage, setChangesMessage] = useState("")

  const { data, isLoading, error } = useQuery<QueueResponse>({
    queryKey: ["admin", "commerce", "products", "queue"],
    queryFn: async () =>
      (await api.get("/v1/commerce/internal/products/queue", { headers: ADMIN_HEADERS })).data.data,
  })

  const detail = useProductDetail(actionFor)
  const media = useProductMedia(actionFor)
  const attrs = useProductAttrs(actionFor)

  // Reset form fields when the modal target changes
  useEffect(() => {
    setNotes("")
    setReason("")
    setChangesMessage("")
  }, [actionFor])

  const reset = () => {
    setActionFor(null)
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

  // Phase 3.4 — request-changes parks the listing in changes_requested with
  // moderator feedback. The seller fixes + resubmits without losing context.
  const requestChanges = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) =>
      api.post(
        `/v1/commerce/internal/products/${id}/request-changes`,
        { reason: message },
        { headers: ADMIN_HEADERS },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "commerce", "products", "queue"] })
      reset()
    },
  })

  const products = data?.products ?? []
  const product = detail.data?.product
  const mediaList = media.data ?? []
  const attrList = attrs.data ?? []

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Product Approval Queue</h1>
      <p className="mt-1 text-sm text-gray-600">
        Products submitted by sellers awaiting moderator review. Approve to publish, reject to
        block, or request changes to send detailed feedback back to the seller.
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
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{product?.title ?? "Review product"}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Seller: <span className="font-mono">{actionFor}</span>
                </p>
              </div>
              <button
                onClick={() => reset()}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {detail.isLoading ? (
              <div className="mt-4 text-sm text-gray-500">Loading product…</div>
            ) : (
              <>
                {product && (
                  <>
                    {/* Media */}
                    <section className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Media ({mediaList.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {product.primary_image_media_id && (
                          <div className="relative">
                            <MediaThumb mediaId={product.primary_image_media_id} />
                            <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold uppercase rounded px-1">
                              Cover
                            </span>
                          </div>
                        )}
                        {mediaList.map((m) => (
                          <MediaThumb key={m.id} mediaId={m.media_id} />
                        ))}
                        {!product.primary_image_media_id && mediaList.length === 0 && (
                          <p className="text-xs text-red-600 italic">
                            ⚠ No media uploaded — sellers must provide at least one image.
                          </p>
                        )}
                      </div>
                    </section>

                    {/* Compliance */}
                    <section className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Compliance
                      </h3>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <Field label="Brand" value={product.brand_name} />
                        <Field label="Manufacturer" value={product.manufacturer_name} />
                        <Field label="HSN Code" value={product.hsn_code} />
                        <Field label="Country of Origin" value={product.country_of_origin} />
                        <Field label="Warranty" value={product.warranty_info} />
                        <Field
                          label="Return Policy"
                          value={
                            product.return_policy_type
                              ? `${product.return_policy_type} (${product.return_policy_days ?? 0}d)`
                              : null
                          }
                        />
                        <Field
                          label="Dimensions"
                          value={
                            product.length_cm || product.width_cm || product.height_cm
                              ? `${product.length_cm ?? 0} × ${product.width_cm ?? 0} × ${product.height_cm ?? 0} cm`
                              : null
                          }
                        />
                        <Field
                          label="Weight"
                          value={product.weight_grams ? `${product.weight_grams} g` : null}
                        />
                      </dl>
                      {(!product.hsn_code || !product.country_of_origin) && (
                        <p className="mt-2 text-xs text-amber-700">
                          ⚠ Missing compliance fields. Indian marketplace listings require HSN +
                          country of origin.
                        </p>
                      )}
                    </section>

                    {/* Description */}
                    {product.description && (
                      <section className="mt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                          Description
                        </h3>
                        <p className="text-sm whitespace-pre-line text-gray-700">
                          {product.description}
                        </p>
                      </section>
                    )}

                    {/* Attributes */}
                    {attrList.length > 0 && (
                      <section className="mt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                          Attributes
                        </h3>
                        <dl className="grid grid-cols-2 gap-2 text-xs">
                          {attrList.map((a, i) => (
                            <div key={i}>
                              <dt className="text-gray-500">{a.name}</dt>
                              <dd className="font-medium text-gray-900">
                                {a.value}
                                {a.unit ? ` ${a.unit}` : ""}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {/* Actions */}
            <div className="mt-6 space-y-3 border-t border-gray-200 pt-4">
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
                <span className="text-xs font-medium text-gray-600">
                  Changes requested (visible to seller)
                </span>
                <textarea
                  value={changesMessage}
                  onChange={(e) => setChangesMessage(e.target.value)}
                  rows={2}
                  placeholder="e.g. Add HSN code and country of origin"
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

            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => reset()}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                disabled={!changesMessage || requestChanges.isPending}
                onClick={() =>
                  actionFor && requestChanges.mutate({ id: actionFor, message: changesMessage })
                }
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
              >
                {requestChanges.isPending ? "Sending…" : "Request changes"}
              </button>
              <button
                disabled={!reason || reject.isPending}
                onClick={() => actionFor && reject.mutate({ id: actionFor, reason, notes })}
                className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-40"
              >
                {reject.isPending ? "Rejecting…" : "Reject"}
              </button>
              <button
                disabled={approve.isPending}
                onClick={() => actionFor && approve.mutate({ id: actionFor, notes })}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {approve.isPending ? "Approving…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className={value ? "font-medium text-gray-900" : "italic text-gray-400"}>
        {value || "—"}
      </dd>
    </div>
  )
}
