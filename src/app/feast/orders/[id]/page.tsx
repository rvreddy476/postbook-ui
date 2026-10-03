import type { Metadata } from "next"
import { Suspense } from "react"

import { FeastFrame } from "@/features/feast/customer/components/FeastFrame"
import { OrderDetailScreen } from "@/features/feast/customer/screens/OrderDetailScreen"

export const metadata: Metadata = {
  title: "Order · Feast",
  robots: { index: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <FeastFrame>
      <Suspense fallback={null}>
        <OrderDetailScreen orderId={id} />
      </Suspense>
    </FeastFrame>
  )
}
