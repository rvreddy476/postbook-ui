"use client"

// /shop/sell/products: GET /seller/products (every status, drafts included).
// Row actions: Edit, Stock, Preview, and Submit for review — offered only for
// a submittable listing whose GET /products/:id/readiness says nothing is
// missing.

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useGlobalToast } from "@/contexts/ToastContext"
import { inrMinor } from "../money"
import { SELLER_PAGE_SIZE, useMyProductsPage, useProductReadiness, useSellerStatus, useSubmitProduct } from "../hooks/sell"
import { productRow, sellerStatusBanner, submitOffered, submitProductError, type ProductRow } from "../model/sell"
import { EmptyState, ErrorState, PageHead, Pill, RowsSkeleton } from "../components/sell/primitives"
import { NotTradingYet } from "../components/sell/SellerShell"

export function ProductsScreen() {
  const status = useSellerStatus()
  const seller = status.data ?? null
  const canTrade = !!seller && sellerStatusBanner(seller).canTrade
  const [offset, setOffset] = useState(0)
  const page = useMyProductsPage(offset, SELLER_PAGE_SIZE, canTrade)

  if (!seller) return null

  const actions = (
    <Link href="/shop/sell/products/new">
      <Button size="sm">New listing</Button>
    </Link>
  )

  if (!canTrade) {
    return (
      <div>
        <PageHead title="Products" />
        <NotTradingYet seller={seller} />
      </div>
    )
  }

  return (
    <div>
      <PageHead title="Products" actions={actions} />
      {page.isPending ? (
        <RowsSkeleton rows={5} />
      ) : page.isError ? (
        <ErrorState text="Your listings could not be loaded." onRetry={() => void page.refetch()} />
      ) : page.data.items.length === 0 ? (
        <EmptyState text={offset === 0 ? "No listings yet." : "No more listings."} action={offset === 0 ? { label: "Create the first one", href: "/shop/sell/products/new" } : { label: "Back to the first page", onClick: () => setOffset(0) }} />
      ) : (
        <>
          <table className="shop-sell-table">
            <thead>
              <tr>
                <th scope="col">Listing</th>
                <th scope="col">Status</th>
                <th scope="col" className="is-num">
                  Price
                </th>
                <th scope="col" className="is-num">
                  Stock
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {page.data.items.map((p) => (
                <ProductTableRow key={p.id} row={productRow(p)} />
              ))}
            </tbody>
          </table>
          <div className="shop-sell-pager">
            <Button variant="ghost" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - SELLER_PAGE_SIZE))}>
              Previous
            </Button>
            <span className="shop-sell-muted">
              {offset + 1}–{Math.min(offset + page.data.items.length, page.data.total)} of {page.data.total}
            </span>
            <Button variant="ghost" size="sm" disabled={offset + SELLER_PAGE_SIZE >= page.data.total} onClick={() => setOffset(offset + SELLER_PAGE_SIZE)}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function ProductTableRow({ row }: { row: ProductRow }) {
  const toast = useGlobalToast()
  const readiness = useProductReadiness(row.id, row.submittable)
  const submit = useSubmitProduct()
  const offered = submitOffered(row, readiness.data)
  const missing = row.submittable && readiness.data && !readiness.data.ready ? readiness.data.missing : []

  async function send() {
    try {
      await submit.mutateAsync(row.id)
      toast({ type: "success", title: "Sent for review", description: row.title })
    } catch (err) {
      toast({ type: "error", title: "Not sent", description: submitProductError(err) })
    }
  }

  return (
    <tr>
      <td>
        <div className="shop-sell-table__listing">
          {row.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.imageUrl} alt="" className="shop-sell-thumb" loading="lazy" />
          ) : (
            <span className="shop-sell-thumb shop-sell-thumb--empty" aria-hidden="true" />
          )}
          <div>
            <Link href={`/shop/sell/products/${row.id}`} className="shop-sell-link">
              {row.title}
            </Link>
            {row.rejectionReason ? <p className="shop-sell-field__error">{row.rejectionReason}</p> : null}
            {missing.length > 0 ? <p className="shop-sell-muted">Still needed: {missing.map((m) => m.label || m.code).join(", ")}</p> : null}
          </div>
        </div>
      </td>
      <td>
        <Pill tone={row.statusTone}>{row.statusLabel}</Pill>
      </td>
      <td className="is-num shop-sell-price">{row.priceMinor === null ? "—" : inrMinor(row.priceMinor)}</td>
      <td className="is-num">{row.stock === null ? "—" : row.stock}</td>
      <td>
        <div className="shop-sell-rowactions">
          <Link href={`/shop/sell/products/${row.id}`} className="shop-sell-link">
            Edit
          </Link>
          <Link href={`/shop/products/${row.id}`} className="shop-sell-link">
            Preview
          </Link>
          <Link href={`/shop/sell/stock?product=${row.id}`} className="shop-sell-link">
            Stock
          </Link>
          {offered ? (
            <Button size="sm" variant="outline" disabled={submit.isPending} onClick={() => void send()}>
              {submit.isPending ? "Sending…" : "Submit for review"}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
