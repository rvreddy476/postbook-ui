import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { AddressesScreen } from "@/features/doorstep/screens/AddressesScreen"

export const metadata: Metadata = {
  title: "Addresses · Doorstep",
  robots: { index: false },
}

export default function Page() {
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <AddressesScreen />
      </Suspense>
    </DoorstepFrame>
  )
}
