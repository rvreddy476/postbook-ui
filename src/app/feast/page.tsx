import type { Metadata } from "next"
import { Suspense } from "react"

import { FeastFrame } from "@/features/feast/customer/components/FeastFrame"
import { HomeScreen } from "@/features/feast/customer/screens/HomeScreen"

export const metadata: Metadata = {
  title: "Feast",
  robots: { index: false },
}

export default function Page() {
  return (
    <FeastFrame>
      <Suspense fallback={null}>
        <HomeScreen />
      </Suspense>
    </FeastFrame>
  )
}
