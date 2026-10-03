import type { Metadata } from "next"
import { Suspense } from "react"

import { FeastFrame } from "@/features/feast/customer/components/FeastFrame"
import { RestaurantScreen } from "@/features/feast/customer/screens/RestaurantScreen"

export const metadata: Metadata = {
  title: "Restaurant · Feast",
  robots: { index: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <FeastFrame>
      <Suspense fallback={null}>
        <RestaurantScreen restaurantId={id} />
      </Suspense>
    </FeastFrame>
  )
}
