import type { Metadata } from "next"
import { Suspense } from "react"

import { ReviewScreen } from "@/features/shop/orders/ReviewScreen"

export const metadata: Metadata = {
  title: "Write a review · MStore",
  robots: { index: false },
}

export default async function ShopOrderReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={null}>
      <ReviewScreen orderId={id} />
    </Suspense>
  )
}
