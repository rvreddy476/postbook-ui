"use client"

import { Suspense } from "react"

import { BookmarksScreen } from "@/features/echo/screens"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BookmarksScreen />
    </Suspense>
  )
}
