import type { Metadata } from "next"

import { notePageMetadata } from "@/features/share/routeMetadata"

import { StatusPageClient } from "./StatusPageClient"

type Props = { params: Promise<{ handle: string; id: string }> }

/*
  /echo/<handle>/status/<id> — one post (X's permalink). Public in the
  middleware, like the old /echo/note/<id>: a public note opens signed out
  (founder default 11). The link preview reads GET /v1/notes/:id signed
  out. /echo/i/status/<id> works too; the page settles on the real handle.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return notePageMetadata(id)
}

export default function EchoStatusPage() {
  return <StatusPageClient />
}
