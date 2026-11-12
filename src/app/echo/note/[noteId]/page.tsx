import type { Metadata } from "next"

import { notePageMetadata } from "@/features/share/routeMetadata"

import { NotePageClient } from "./NotePageClient"

type Props = { params: Promise<{ noteId: string }> }

/*
  /echo/note/<id> — one note's public permalink: what Share copies, and
  where note_reply / note_quote notifications land. /echo/note/ is a public
  prefix in the middleware, so a public note opens signed out (founder
  default 11). The link preview (OpenGraph + Twitter card) comes from
  GET /v1/notes/:id read signed out; a closed Echo or a note a stranger may
  not see gets the neutral card and names nothing.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { noteId } = await params
  return notePageMetadata(noteId)
}

export default function EchoNotePage() {
  return <NotePageClient />
}
