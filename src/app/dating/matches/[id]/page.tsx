import type { Metadata } from "next"

import { CHECKIN_PARAM, wantsCheckin } from "@/features/dating/model/dateCheckin"
import { MatchScreen } from "@/features/dating/screens/MatchScreen"

export const metadata: Metadata = { title: "Match" }

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  const query = await searchParams
  // ?checkin=1 — the after-date check-in's deep link (M14) opens its sheet.
  return <MatchScreen id={id} checkin={wantsCheckin(query[CHECKIN_PARAM])} />
}
