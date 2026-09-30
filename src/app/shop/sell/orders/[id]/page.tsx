import type { Metadata } from "next"

import { OrderDetailScreen } from "@/features/shop/sell/OrderDetailScreen"

export const metadata: Metadata = { title: "Order" }

export default async function SellOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetailScreen orderId={id} />
}
