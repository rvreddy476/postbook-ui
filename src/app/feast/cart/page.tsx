import type { Metadata } from "next"
import { Suspense } from "react"

import { FeastFrame } from "@/features/feast/customer/components/FeastFrame"
import { CartScreen } from "@/features/feast/customer/screens/CartScreen"

export const metadata: Metadata = {
  title: "Cart · Feast",
  robots: { index: false },
}

export default function Page() {
  return (
    <FeastFrame>
      <Suspense fallback={null}>
        <CartScreen />
      </Suspense>
    </FeastFrame>
  )
}
