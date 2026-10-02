import type { Metadata } from "next"

import { SelfieScreen } from "@/features/dating/screens/SelfieScreen"

export const metadata: Metadata = { title: "Selfie check" }

export default function Page() {
  return <SelfieScreen />
}
