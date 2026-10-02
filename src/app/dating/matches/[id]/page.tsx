import type { Metadata } from "next"

import { MatchScreen } from "@/features/dating/screens/MatchScreen"

export const metadata: Metadata = { title: "Match" }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MatchScreen id={id} />
}
