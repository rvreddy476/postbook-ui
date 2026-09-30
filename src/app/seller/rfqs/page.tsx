import { redirect } from "next/navigation"

/** The seller side moved to /shop/sell (lane W3). This path only forwards. */
export default function LegacySellerRedirect() {
  redirect("/shop/sell")
}
