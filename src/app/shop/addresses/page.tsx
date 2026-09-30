import type { Metadata } from "next"

import { AddressesScreen } from "@/features/shop/addresses/AddressesScreen"

export const metadata: Metadata = {
  title: "Addresses",
  robots: { index: false },
}

export default function ShopAddressesPage() {
  return <AddressesScreen />
}
