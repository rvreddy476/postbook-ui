import { redirect } from "next/navigation"

// The cart is the bag now, in the MStore zone.
export default function CartRedirect() {
  redirect("/shop/bag")
}
