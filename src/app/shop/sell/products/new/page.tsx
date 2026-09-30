import type { Metadata } from "next"

import { ListingEditorScreen } from "@/features/shop/sell/ListingEditorScreen"

export const metadata: Metadata = { title: "New listing" }

export default function SellNewProductPage() {
  return <ListingEditorScreen productId={null} />
}
