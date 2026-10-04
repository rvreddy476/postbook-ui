import type { Metadata } from "next"
import { Suspense } from "react"

import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { ChatScreen } from "@/features/doorstep/screens/ChatScreen"

export const metadata: Metadata = {
  title: "Chat · Doorstep",
  robots: { index: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <DoorstepFrame>
      <Suspense fallback={null}>
        <ChatScreen bookingId={id} />
      </Suspense>
    </DoorstepFrame>
  )
}
