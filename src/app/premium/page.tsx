"use client"

import AppShell from "@/components/AppShell"
import { PremiumScreen } from "@/features/premium/screens"

/**
 * `/premium` — buy a Momentum Premium pass (monetization-service
 * /v1/monetization/premium). Signed in only: the middleware protects every
 * route not listed as public, and AppShell keeps its sign-in gate.
 */
export default function PremiumPage() {
  return (
    <AppShell>
      <PremiumScreen />
    </AppShell>
  )
}
