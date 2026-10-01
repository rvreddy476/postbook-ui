"use client"

// The product page's "You pay ₹283 with coupon CODE": drawn from the
// server's `best_coupon` only (model/coupons.ts bestCoupon), never priced here.

import { TicketPercent } from "lucide-react"

import { inrMinor } from "../../money"
import type { BestCoupon } from "../../model/coupons"

import "../../shop-offers.css"

export function CouponChip({ coupon }: { coupon: BestCoupon | null }) {
  if (!coupon) return null
  return (
    <p className="shop-coupon-chip" title={coupon.title || undefined}>
      <TicketPercent size={14} aria-hidden="true" />
      <span>
        You pay <span className="shop-coupon-chip__price">{inrMinor(coupon.priceAfterMinor)}</span> with coupon{" "}
        <span className="shop-coupon-chip__code">{coupon.code}</span>
      </span>
    </p>
  )
}
