"use client"

import { useParams } from "next/navigation"

import { PublicPageChrome } from "@/components/PublicPageChrome"
import { NoteScreen } from "@/features/echo/screens"

export function NotePageClient() {
  const params = useParams<{ noteId: string }>()
  const id = typeof params?.noteId === "string" ? params.noteId : ""
  return (
    <PublicPageChrome>
      <NoteScreen id={id} />
    </PublicPageChrome>
  )
}
