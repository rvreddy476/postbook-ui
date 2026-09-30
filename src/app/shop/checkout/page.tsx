import type { Metadata } from "next"
import { Suspense } from "react"

import { CheckoutScreen } from "@/features/shop/checkout/CheckoutScreen"

export const metadata: Metadata = {
  title: "Checkout · MStore",
  robots: { index: false },
}

export default function ShopCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutScreen />
    </Suspense>
  )
}
