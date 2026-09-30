import type { Metadata } from "next"

import { ProductsScreen } from "@/features/shop/sell/ProductsScreen"

export const metadata: Metadata = { title: "Products" }

export default function SellProductsPage() {
  return <ProductsScreen />
}
