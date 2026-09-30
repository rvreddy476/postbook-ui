import { redirect } from "next/navigation"

// The shop moved to /shop on 30 Sep 2026; the review page lives with the order.
export default async function LegacyReviewRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") q.set(k, v)
  const suffix = q.toString()
  redirect(`/shop/orders/${encodeURIComponent(id)}/review${suffix ? `?${suffix}` : ""}`)
}
