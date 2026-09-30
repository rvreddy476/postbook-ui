import type { Metadata } from "next"
import { Suspense } from "react"

import { BrowseScreen } from "@/features/shop/storefront/BrowseScreen"

export const metadata: Metadata = {
  title: "Browse",
  description: "Search and filter everything on MStore.",
}

// The screen reads the URL with useSearchParams, which needs a Suspense
// boundary to keep the route prerenderable.
export default function ShopBrowsePage() {
  return (
    <Suspense fallback={null}>
      <BrowseScreen />
    </Suspense>
  )
}
