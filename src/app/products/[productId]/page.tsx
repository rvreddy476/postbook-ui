import { redirect } from "next/navigation"

// Product pages moved to /shop/products/[id]. Kept so shared links still land.
export default async function ProductRedirect({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  redirect(`/shop/products/${encodeURIComponent(productId)}`)
}
