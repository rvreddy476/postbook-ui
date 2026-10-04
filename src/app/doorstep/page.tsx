import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { HomeScreen } from "@/features/doorstep/screens/HomeScreen"

export const metadata: Metadata = {
  title: "Doorstep",
  robots: { index: false },
}

export default function Page() {
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <HomeScreen />
      </Suspense>
    </DoorstepFrame>
  )
}
