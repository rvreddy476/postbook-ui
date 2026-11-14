"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"

import { ProfileScreen } from "@/features/echo/screens"

/* /echo/<handle> — the Echo profile. */
export default function EchoProfilePage() {
  const params = useParams<{ handle: string }>()
  const handle = decodeURIComponent(typeof params?.handle === "string" ? params.handle : "")
  return (
    <Suspense fallback={null}>
      <ProfileScreen key={handle} handle={handle} />
    </Suspense>
  )
}
