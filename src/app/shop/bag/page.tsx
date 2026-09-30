import type { Metadata } from "next"

import { BagScreen } from "@/features/shop/bag/BagScreen"

export const metadata: Metadata = {
  title: "Bag",
  robots: { index: false },
}

export default function ShopBagPage() {
  return <BagScreen />
}
