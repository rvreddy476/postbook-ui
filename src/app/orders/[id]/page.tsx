import { redirect } from "next/navigation"

/*
  The shop moved to /shop. The buyer's order deep link (`/orders/{id}` in
  older notifications) lands on the new order page; the query rides along
  so `?confirming=1` keeps its meaning.
*/
export default async function OrderRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first !== undefined) qs.set(key, first)
  }
  const suffix = qs.toString()
  redirect(`/shop/orders/${encodeURIComponent(id)}${suffix ? `?${suffix}` : ""}`)
}
