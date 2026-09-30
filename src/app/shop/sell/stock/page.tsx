import type { Metadata } from "next"
import { Suspense } from "react"

import { StockScreen } from "@/features/shop/sell/StockScreen"

export const metadata: Metadata = { title: "Stock" }

export default function SellStockPage() {
  return (
    <Suspense fallback={null}>
      <StockScreen />
    </Suspense>
  )
}
