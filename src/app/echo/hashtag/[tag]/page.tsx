"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"

import { HashtagScreen } from "@/features/echo/screens"

/* /echo/hashtag/<tag> — notes only (never ordinary posts). */
export default function HashtagPage() {
  const params = useParams<{ tag: string }>()
  const tag = decodeURIComponent(typeof params?.tag === "string" ? params.tag : "")
  return (
    <Suspense fallback={null}>
      <HashtagScreen key={tag} tag={tag} />
    </Suspense>
  )
}
