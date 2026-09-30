import { redirect } from "next/navigation"

/*
  The shop moved to /shop. Old links and notifications still say /orders;
  they land on the new list. `?history=1` is carried across.
*/
export default async function OrdersRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const history = query.history
  const flag = Array.isArray(history) ? history[0] : history
  redirect(flag === "1" || flag === "true" ? "/shop/orders?history=1" : "/shop/orders")
}
