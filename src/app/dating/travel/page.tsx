import type { Metadata } from "next"

import { TravelScreen } from "@/features/dating/screens/TravelScreen"

export const metadata: Metadata = { title: "Travel" }

export default function Page() {
  return <TravelScreen />
}
