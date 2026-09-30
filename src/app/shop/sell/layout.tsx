import type { Metadata } from "next"
import { Suspense } from "react"

import { SellerShell } from "@/features/shop/components/sell/SellerShell"

export const metadata: Metadata = {
  title: { default: "MSeller", template: "%s · MSeller" },
  description: "Sell on MStore.",
  robots: { index: false },
}

/** Every /shop/sell route: the MSeller frame (rail, wordmark, status banner) and the no-profile gate. */
export default function SellLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SellerShell>{children}</SellerShell>
    </Suspense>
  )
}
