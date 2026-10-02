import type { Metadata } from "next"

import { RootScreen } from "@/features/dating/screens/RootScreen"

export const metadata: Metadata = { title: { absolute: "Pulse" } }

export default function Page() {
  return <RootScreen />
}
