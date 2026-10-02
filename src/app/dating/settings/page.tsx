import type { Metadata } from "next"

import { SettingsScreen } from "@/features/dating/screens/SettingsScreen"

export const metadata: Metadata = { title: "Settings" }

export default function Page() {
  return <SettingsScreen />
}
