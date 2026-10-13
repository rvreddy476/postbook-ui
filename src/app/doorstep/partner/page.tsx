import { Suspense } from "react"
import type { Metadata } from "next"
import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { PartnerScreen } from "@/features/doorstep/partner/PartnerScreen"

export const metadata: Metadata = { title: "Doorstep Partner Workspace", robots: { index: false } }
export default function Page() {
  return <DoorstepFrame partner><Suspense fallback={<p role="status">Loading workspace…</p>}><PartnerScreen /></Suspense></DoorstepFrame>
}
