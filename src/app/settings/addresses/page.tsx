import { redirect } from "next/navigation"

// The address book lives with the shop since 30 Sep 2026 (/shop/addresses).
export default function LegacyAddressesRedirect() {
  redirect("/shop/addresses")
}
