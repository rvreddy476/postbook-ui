import type { Metadata } from "next"

import { OnboardingWizardScreen } from "@/features/shop/sell/OnboardingWizardScreen"

export const metadata: Metadata = { title: "Application" }

export default function SellOnboardingPage() {
  return <OnboardingWizardScreen />
}
