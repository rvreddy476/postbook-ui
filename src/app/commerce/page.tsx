import { redirect } from "next/navigation"

// /commerce was the seller pitch page; the shop's front door is /shop, and
// "Sell on MStore" lives in its header menu.
export default function CommerceRedirect() {
  redirect("/shop")
}
