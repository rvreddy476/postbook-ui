import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { ProfessionalsScreen } from "@/features/doorstep/screens/ProfessionalsScreen"

export const metadata: Metadata = {
  title: "Choose a professional · Doorstep",
  robots: { index: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <ProfessionalsScreen serviceId={id} />
      </Suspense>
    </DoorstepFrame>
  )
}
