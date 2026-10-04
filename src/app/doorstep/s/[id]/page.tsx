import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { ServiceScreen } from "@/features/doorstep/screens/ServiceScreen"

export const metadata: Metadata = {
  title: "Service · Doorstep",
  robots: { index: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <ServiceScreen serviceId={id} />
      </Suspense>
    </DoorstepFrame>
  )
}
