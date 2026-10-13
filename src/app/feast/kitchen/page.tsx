import { Suspense } from "react"
import { KitchenConsole } from "@/features/feast/kitchen/components/KitchenConsole"

export default function FeastKitchenPage() {
  return <Suspense fallback={<p role="status">Loading workspace…</p>}><KitchenConsole /></Suspense>
}
