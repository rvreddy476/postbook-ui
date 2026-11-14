"use client"

import { Suspense } from "react"

import { ExploreScreen } from "@/features/echo/screens"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ExploreScreen />
    </Suspense>
  )
}
