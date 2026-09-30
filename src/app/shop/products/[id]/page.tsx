import type { Metadata } from "next"

import { ProductScreen } from "@/features/shop/storefront/ProductScreen"

export const metadata: Metadata = {
  title: "Product",
}

export default async function ShopProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProductScreen productId={id} />
}
