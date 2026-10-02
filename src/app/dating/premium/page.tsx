import type { Metadata } from "next"

import { PremiumScreen } from "@/features/dating/screens/PremiumScreen"

export const metadata: Metadata = { title: "Premium" }

export default function Page() {
  return <PremiumScreen />
}
