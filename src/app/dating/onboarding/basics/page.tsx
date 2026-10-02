import type { Metadata } from "next"

import { BasicsScreen } from "@/features/dating/screens/OnboardingScreens"

export const metadata: Metadata = { title: "The basics" }

export default function Page() {
  return <BasicsScreen />
}
