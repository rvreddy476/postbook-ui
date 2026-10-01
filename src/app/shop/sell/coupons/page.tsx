import type { Metadata } from "next"
import { Suspense } from "react"

import { CouponsScreen } from "@/features/shop/sell/CouponsScreen"

export const metadata: Metadata = { title: "Coupons" }

export default function SellCouponsPage() {
  return (
    <Suspense fallback={null}>
      <CouponsScreen />
    </Suspense>
  )
}
