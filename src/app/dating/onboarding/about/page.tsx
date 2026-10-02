import type { Metadata } from "next"

import { AboutMeScreen } from "@/features/dating/screens/OnboardingScreens"

export const metadata: Metadata = { title: "About me" }

export default function Page() {
  return <AboutMeScreen />
}
