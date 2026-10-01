import { ShopFrame } from "@/features/shop/components/ShopFrame"
import "@/features/shop/shop.css"
import "@/features/live/live.css"

/** Shared commerce chrome, but Live keeps its own identity and real stream APIs. */
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <ShopFrame context="live">{children}</ShopFrame>
}
