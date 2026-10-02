import type { Metadata } from "next"

import { PromptsScreen } from "@/features/dating/screens/OnboardingScreens"

export const metadata: Metadata = { title: "Prompts" }

export default function Page() {
  return <PromptsScreen />
}
