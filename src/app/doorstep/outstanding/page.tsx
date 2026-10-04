import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { OutstandingScreen } from "@/features/doorstep/screens/OutstandingScreen"

export const metadata: Metadata = {
  title: "Dues · Doorstep",
  robots: { index: false },
}

export default function Page() {
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <OutstandingScreen />
      </Suspense>
    </DoorstepFrame>
  )
}
