import type { Metadata } from "next"

import { PreferencesScreen } from "@/features/dating/screens/OnboardingScreens"

export const metadata: Metadata = { title: "Preferences" }

export default function Page() {
  return <PreferencesScreen />
}
