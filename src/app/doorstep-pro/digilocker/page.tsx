import type { Metadata } from "next"
import { DoorstepFrame } from "@/features/doorstep/components/DoorstepFrame"
import { IdentityCallback } from "@/features/doorstep/partner/IdentityCallback"

export const metadata: Metadata = { title: "Doorstep identity verification", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default function Page() { return <DoorstepFrame partner><IdentityCallback /></DoorstepFrame> }
