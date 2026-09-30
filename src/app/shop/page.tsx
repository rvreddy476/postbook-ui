import type { Metadata } from "next"

import { HomeScreen } from "@/features/shop/storefront/HomeScreen"

export const metadata: Metadata = {
  title: "MStore",
  description: "Deals of the day, best sellers and new arrivals on MStore.",
}

export default function ShopHomePage() {
  return <HomeScreen />
}
