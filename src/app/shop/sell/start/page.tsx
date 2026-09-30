import type { Metadata } from "next"

import { SellerStartScreen } from "@/features/shop/sell/SellerStartScreen"

export const metadata: Metadata = { title: "Sell on MStore" }

export default function SellStartPage() {
  return <SellerStartScreen />
}
