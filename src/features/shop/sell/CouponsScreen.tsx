"use client"

// /shop/sell/coupons: the seller's coupons — list, create, edit, and
// deactivate (PATCH is_active=false; there is no delete).
//
//   GET   /v1/commerce/seller/coupons
//   POST  /v1/commerce/seller/coupons
//   PATCH /v1/commerce/seller/coupons/:id

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useGlobalToast } from "@/contexts/ToastContext"

import { useAllMyProducts, useSellerStatus } from "../hooks/sell"
import { usePatchSellerCoupon, useSellerCoupons } from "../hooks/sellerCoupons"
import { inrMinor } from "../money"
import { sellerStatusBanner, type BannerTone } from "../model/sell"
import {
  COUPON_STATE_LABEL,
  activeBody,
  couponState,
  discountSummary,
  usesSummary,
  type CouponState,
  type SellerCoupon,
} from "../model/sellerCoupons"
import { CouponForm } from "../components/sell/CouponForm"
import { EmptyState, ErrorState, PageHead, Pill, RowsSkeleton, formatWhen } from "../components/sell/primitives"
import { NotTradingYet } from "../components/sell/SellerShell"

import "../shop-offers.css"

const STATE_TONE: Record<CouponState, BannerTone> = {
  active: "success",
  expired: "muted",
  inactive: "muted",
  scheduled: "info",
  used_up: "warning",
}

function validity(c: SellerCoupon): string {
  const from = formatWhen(c.startsAt)
  const until = formatWhen(c.expiresAt)
  if (from && until) return `${from} – ${until}`
  if (until) return `Until ${until}`
  if (from) return `From ${from}`
  return "No end date"
}

export function CouponsScreen() {
  const status = useSellerStatus()
  const seller = status.data ?? null
  const canTrade = !!seller && sellerStatusBanner(seller).canTrade
  const coupons = useSellerCoupons(canTrade)
  const products = useAllMyProducts(canTrade)
  const patch = usePatchSellerCoupon()
  const toast = useGlobalToast()
  const [editing, setEditing] = useState<SellerCoupon | "new" | null>(null)
  const [deactivating, setDeactivating] = useState<SellerCoupon | null>(null)
  const productOptions = useMemo(
    () => (products.data ?? []).filter((p) => p.id).map((p) => ({ id: p.id, title: p.title || "Untitled listing" })),
    [products.data],
  )
  const now = Date.now()

  if (!seller) return null
  if (!canTrade) {
    return (
      <div>
        <PageHead title="Coupons" />
        <NotTradingYet seller={seller} />
      </div>
    )
  }

  const setActive = async (c: SellerCoupon, isActive: boolean) => {
    try {
      await patch.mutateAsync({ id: c.id, body: activeBody(isActive) })
      toast({ type: "success", title: isActive ? `${c.code} is on` : `${c.code} is off` })
      setDeactivating(null)
    } catch {
      toast({ type: "error", title: "The coupon couldn't be changed. Try again." })
    }
  }

  const list = coupons.data ?? []

  return (
    <div className="shop-sell-coupons">
      <PageHead
        title="Coupons"
        sub="Codes buyers enter at checkout. Public codes also show on your product pages. You pay for the discount."
        actions={
          editing === null ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              New coupon
            </Button>
          ) : null
        }
      />

      {editing !== null ? (
        <CouponForm
          key={editing === "new" ? "new" : editing.id}
          coupon={editing === "new" ? null : editing}
          products={productOptions}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {coupons.isError ? (
        <ErrorState text="Your coupons could not be loaded." onRetry={() => void coupons.refetch()} />
      ) : coupons.isPending ? (
        <RowsSkeleton rows={3} />
      ) : list.length === 0 ? (
        editing === null ? <EmptyState text="No coupons yet." action={{ label: "Create a coupon", onClick: () => setEditing("new") }} /> : null
      ) : (
        <div className="shop-sell-coupons__table-wrap">
          <table className="shop-sell-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Discount</th>
                <th scope="col" className="is-num">
                  Minimum order
                </th>
                <th scope="col">Uses</th>
                <th scope="col">Valid</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const state = couponState(c, now)
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="shop-sell-coupons__code">{c.code}</span>
                      <p className="shop-sell-muted">{c.isPublic ? "Public" : "Secret"}{c.description ? ` · ${c.description}` : ""}</p>
                    </td>
                    <td>
                      {discountSummary(c, inrMinor)}
                      <p className="shop-sell-muted">{c.appliesTo === "product" ? `${c.applicableIds.length} chosen product${c.applicableIds.length === 1 ? "" : "s"}` : "All products"}</p>
                    </td>
                    <td className="is-num">{c.minOrderMinor > 0 ? inrMinor(c.minOrderMinor) : "None"}</td>
                    <td>
                      {usesSummary(c)}
                      <p className="shop-sell-muted">{c.maxUsesPerUser} per buyer</p>
                    </td>
                    <td>{validity(c)}</td>
                    <td>
                      <Pill tone={STATE_TONE[state]}>{COUPON_STATE_LABEL[state]}</Pill>
                    </td>
                    <td>
                      <div className="shop-sell-coupons__row-actions">
                        <Button size="sm" variant="outline" onClick={() => setEditing(c)} disabled={editing !== null}>
                          Edit
                        </Button>
                        {c.isActive ? (
                          <Button size="sm" variant="ghost" onClick={() => setDeactivating(c)} disabled={patch.isPending}>
                            Deactivate
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => void setActive(c, true)} disabled={patch.isPending}>
                            Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && void setActive(deactivating, false)}
        title={deactivating ? `Deactivate ${deactivating.code}?` : "Deactivate this coupon?"}
        description="Buyers can no longer use it. Orders already placed keep their discount, and you can activate it again later."
        confirmLabel="Deactivate"
        loading={patch.isPending}
      />
    </div>
  )
}
