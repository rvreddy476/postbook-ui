"use client"

import { Suspense } from "react"

import { ScheduledScreen } from "@/features/echo/screens"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ScheduledScreen />
    </Suspense>
  )
}
