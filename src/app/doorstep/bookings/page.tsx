import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { BookingsScreen } from "@/features/doorstep/screens/BookingsScreen"

export const metadata: Metadata = {
  title: "Bookings · Doorstep",
  robots: { index: false },
}

export default function Page() {
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <BookingsScreen />
      </Suspense>
    </DoorstepFrame>
  )
}
