import type { Metadata } from "next"

import { DashboardScreen } from "@/features/shop/sell/DashboardScreen"

export const metadata: Metadata = { title: "Dashboard" }

export default function SellDashboardPage() {
  return <DashboardScreen />
}
