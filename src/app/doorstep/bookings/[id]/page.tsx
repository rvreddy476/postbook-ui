import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { BookingDetailScreen } from "@/features/doorstep/screens/BookingDetailScreen"

export const metadata: Metadata = {
  title: "Booking · Doorstep",
  robots: { index: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <BookingDetailScreen bookingId={id} />
      </Suspense>
    </DoorstepFrame>
  )
}
