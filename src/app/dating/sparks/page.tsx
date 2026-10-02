import type { Metadata } from "next"

import { Guard } from "@/features/dating/components/Guard"
import { HomeScreen } from "@/features/dating/screens/HomeScreen"

export const metadata: Metadata = { title: "Liked you" }

export default function Page() {
  return (
    <Guard need="ready">
      <HomeScreen section="sparks" />
    </Guard>
  )
}
