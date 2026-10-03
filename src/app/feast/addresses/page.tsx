import type { Metadata } from "next"
import { Suspense } from "react"

import { FeastFrame } from "@/features/feast/customer/components/FeastFrame"
import { AddressesScreen } from "@/features/feast/customer/screens/AddressesScreen"

export const metadata: Metadata = {
  title: "Addresses · Feast",
  robots: { index: false },
}

export default function Page() {
  return (
    <FeastFrame>
      <Suspense fallback={null}>
        <AddressesScreen />
      </Suspense>
    </FeastFrame>
  )
}
