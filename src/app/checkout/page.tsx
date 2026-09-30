import { redirect } from "next/navigation"

/* The shop moved to /shop; the old checkout path lands on the new one. */
export default function CheckoutRedirect() {
  redirect("/shop/checkout")
}
