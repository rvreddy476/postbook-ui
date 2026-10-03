import type { Metadata } from "next"
import { Suspense } from "react"

import { FeastFrame } from "@/features/feast/customer/components/FeastFrame"
import { OrdersScreen } from "@/features/feast/customer/screens/OrdersScreen"

export const metadata: Metadata = {
  title: "Orders · Feast",
  robots: { index: false },
}

export default function Page() {
  return (
    <FeastFrame>
      <Suspense fallback={null}>
        <OrdersScreen />
      </Suspense>
    </FeastFrame>
  )
}
