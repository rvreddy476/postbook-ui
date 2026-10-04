import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { CheckoutScreen } from "@/features/doorstep/screens/CheckoutScreen"

export const metadata: Metadata = {
  title: "Book · Doorstep",
  robots: { index: false },
}

export default function Page() {
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <CheckoutScreen />
      </Suspense>
    </DoorstepFrame>
  )
}
