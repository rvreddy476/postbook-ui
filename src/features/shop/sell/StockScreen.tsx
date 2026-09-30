"use client"

// /shop/sell/stock: every variant of every product with its available_qty,
// adjusted by a signed delta with a reason through
// PATCH /seller/variants/:id/stock (a ledger entry, never a new total).

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQueries } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { useGlobalToast } from "@/contexts/ToastContext"
import { fetchProductVariants } from "../api/sell"
import { inrMinor } from "../money"
import { sellKeys, useAdjustStock, useAllMyProducts, useSellerStatus } from "../hooks/sell"
import {
  STOCK_REASONS,
  STOCK_REASON_LABEL,
  apiMessage,
  sellerStatusBanner,
  stockAdjustPayload,
  stockRows,
  validateStockAdjust,
  type StockAdjustDraft,
  type StockRow,
} from "../model/sell"
import { EmptyState, ErrorState, Field, Notice, PageHead, RowsSkeleton, Select, TextField, Textarea } from "../components/sell/primitives"
import { NotTradingYet } from "../components/sell/SellerShell"

export function StockScreen() {
  const status = useSellerStatus()
  const seller = status.data ?? null
  const canTrade = !!seller && sellerStatusBanner(seller).canTrade
  const params = useSearchParams()
  const onlyProduct = params?.get("product") || null
  const products = useAllMyProducts(canTrade)
  const list = useMemo(() => (products.data ?? []).filter((p) => !onlyProduct || p.id === onlyProduct), [products.data, onlyProduct])
  const variantQueries = useQueries({
    queries: list.map((p) => ({
      queryKey: sellKeys.variants(p.id),
      queryFn: () => fetchProductVariants(p.id),
      enabled: canTrade,
      retry: false,
    })),
  })
  const [editing, setEditing] = useState<StockRow | null>(null)

  if (!seller) return null
  if (!canTrade) {
    return (
      <div>
        <PageHead title="Stock" />
        <NotTradingYet seller={seller} />
      </div>
    )
  }

  const loading = products.isPending || variantQueries.some((q) => q.isPending)
  const rows: StockRow[] = list.flatMap((p, i) => stockRows({ id: p.id, title: p.title || "Untitled listing" }, variantQueries[i]?.data ?? []))

  return (
    <div>
      <PageHead title="Stock" sub={onlyProduct ? "One listing. Remove the filter to see everything." : "Available units per variant. Adjust by how many you added or removed."} />
      {products.isError ? (
        <ErrorState text="Your listings could not be loaded." onRetry={() => void products.refetch()} />
      ) : loading ? (
        <RowsSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState text="No variants to stock yet." action={{ label: "Create a listing", href: "/shop/sell/products/new" }} />
      ) : (
        <table className="shop-sell-table">
          <thead>
            <tr>
              <th scope="col">Listing</th>
              <th scope="col">Variant</th>
              <th scope="col" className="is-num">
                Price
              </th>
              <th scope="col" className="is-num">
                Available
              </th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.variantId}>
                <td>{r.productTitle}</td>
                <td>
                  <span>{r.sku}</span>
                  {r.options ? <p className="shop-sell-muted">{r.options}</p> : null}
                </td>
                <td className="is-num shop-sell-price">{r.priceMinor === null ? "—" : inrMinor(r.priceMinor)}</td>
                <td className="is-num">{r.available === null ? "—" : r.available}</td>
                <td>
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                    Adjust
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing ? <AdjustDialog row={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}

export function AdjustDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const toast = useGlobalToast()
  const adjust = useAdjustStock()
  const [draft, setDraft] = useState<StockAdjustDraft>({ delta: "", reason: "", notes: "" })
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errors = validateStockAdjust(draft, row.available)

  async function submit() {
    setAttempted(true)
    setError(null)
    if (Object.keys(errors).length > 0) return
    try {
      const level = await adjust.mutateAsync({ variantId: row.variantId, productId: row.productId, body: stockAdjustPayload(draft) })
      toast({ type: "success", title: "Stock updated", description: `${row.sku}: ${level.available} available.` })
      onClose()
    } catch (err) {
      setError(apiMessage(err, "The adjustment was refused."))
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Adjust stock · ${row.sku}`}>
      <form noValidate className="shop-sell-form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <p className="shop-sell-muted">{row.available === null ? "No stock record yet." : `${row.available} available now.`}</p>
        <TextField id="adj-delta" label="Change" required inputMode="numeric" value={draft.delta} onChange={(v) => setDraft((d) => ({ ...d, delta: v }))} error={attempted ? errors.delta : null} help="Positive adds units, negative removes them." />
        <Field id="adj-reason" label="Reason" required error={attempted ? errors.reason : null}>
          <Select id="adj-reason" value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}>
            <option value="">Choose…</option>
            {STOCK_REASONS.map((r) => (
              <option key={r} value={r}>
                {STOCK_REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="adj-notes" label="Note" error={attempted ? errors.notes : null}>
          <Textarea id="adj-notes" rows={2} maxLength={500} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="shop-sell-actions">
          <Button type="submit" disabled={adjust.isPending}>
            {adjust.isPending ? "Saving…" : "Apply"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
