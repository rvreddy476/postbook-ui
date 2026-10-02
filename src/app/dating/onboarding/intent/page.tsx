import type { Metadata } from "next"

import { IntentScreen } from "@/features/dating/screens/OnboardingScreens"

export const metadata: Metadata = { title: "Looking for" }

export default function Page() {
  return <IntentScreen />
}
