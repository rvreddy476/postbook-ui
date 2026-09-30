import type { Metadata } from "next"

import { ListingEditorScreen } from "@/features/shop/sell/ListingEditorScreen"

export const metadata: Metadata = { title: "Edit listing" }

export default async function SellEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ListingEditorScreen productId={id} />
}
