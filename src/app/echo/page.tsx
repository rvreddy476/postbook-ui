"use client"

import AppShell from "@/components/AppShell"
import { EchoHomeScreen } from "@/features/echo/screens"

/*
  /echo — Echo's timelines (Following / For You). Signed in only (the
  middleware gates it). The product gate (components/ProductRouteGate,
  GET /v1/features "echo") renders "Not available" instead while Echo is
  closed, and while the answer is missing: Echo fails closed.
*/
export default function EchoPage() {
  return (
    <AppShell>
      <EchoHomeScreen />
    </AppShell>
  )
}
