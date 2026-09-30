import { redirect } from "next/navigation"

/** The seller side moved to /shop/sell (lane W3). This path only forwards. */
export default async function LegacySellerRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/shop/sell/orders/${id}`)
}
