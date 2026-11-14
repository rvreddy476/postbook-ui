"use client"

import { useParams } from "next/navigation"

import { StatusScreen } from "@/features/echo/screens"

export function StatusPageClient() {
  const params = useParams<{ handle: string; id: string }>()
  const handle = typeof params?.handle === "string" ? decodeURIComponent(params.handle) : "i"
  const id = typeof params?.id === "string" ? params.id : ""
  return <StatusScreen key={id} handle={handle} id={id} />
}
