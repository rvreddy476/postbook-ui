import type { Metadata } from "next"
import { Suspense } from "react"

import { OrdersScreen } from "@/features/shop/orders/OrdersScreen"

export const metadata: Metadata = {
  title: "Orders · MStore",
  robots: { index: false },
}

export default function ShopOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersScreen />
    </Suspense>
  )
}
