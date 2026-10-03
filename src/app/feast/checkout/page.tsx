import type { Metadata } from "next"
import { Suspense } from "react"

import { FeastFrame } from "@/features/feast/customer/components/FeastFrame"
import { CheckoutScreen } from "@/features/feast/customer/screens/CheckoutScreen"

export const metadata: Metadata = {
  title: "Checkout · Feast",
  robots: { index: false },
}

export default function Page() {
  return (
    <FeastFrame>
      <Suspense fallback={null}>
        <CheckoutScreen />
      </Suspense>
    </FeastFrame>
  )
}
