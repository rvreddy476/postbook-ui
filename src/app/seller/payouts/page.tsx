import { redirect } from "next/navigation"

// The seller dashboard links to /seller/payouts but the actual payouts
// surface lives under the unified monetization area at /monetization/payouts
// (used by both creators and sellers — same wallet, payout methods, history).
// Server-side redirect avoids a flash and keeps the canonical URL in the bar.
export default function SellerPayoutsRedirect() {
  redirect("/monetization/payouts")
}
