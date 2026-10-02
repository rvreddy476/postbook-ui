import type { Metadata } from "next"

import { PicksScreen } from "@/features/dating/screens/PicksScreen"

export const metadata: Metadata = { title: "Today's picks" }

export default function Page() {
  return <PicksScreen />
}
