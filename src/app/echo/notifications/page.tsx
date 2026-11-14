"use client"

import { Suspense } from "react"

import { NotificationsScreen } from "@/features/echo/screens"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NotificationsScreen />
    </Suspense>
  )
}
