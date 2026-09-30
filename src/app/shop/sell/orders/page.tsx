import type { Metadata } from "next"
import { Suspense } from "react"

import { OrdersScreen } from "@/features/shop/sell/OrdersScreen"

export const metadata: Metadata = { title: "Orders" }

export default function SellOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersScreen />
    </Suspense>
  )
}
