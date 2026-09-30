import type { Metadata } from "next"
import { Suspense } from "react"

import { OrderDetailScreen } from "@/features/shop/orders/OrderDetailScreen"

export const metadata: Metadata = {
  title: "Order · MStore",
  robots: { index: false },
}

export default async function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={null}>
      <OrderDetailScreen orderId={id} />
    </Suspense>
  )
}
