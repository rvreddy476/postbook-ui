import type { Metadata } from "next"

import { SafetyScreen } from "@/features/dating/screens/SafetyScreen"

export const metadata: Metadata = { title: "Safety" }

export default function Page() {
  return <SafetyScreen />
}
