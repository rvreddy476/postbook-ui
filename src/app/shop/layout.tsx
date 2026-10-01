import type { Metadata } from "next"

import { ShopFrame } from "@/features/shop/components/ShopFrame"
import "@/features/shop/shop.css"

/*
  The MStore zone: the shop header, then <main>. Every /shop page — the
  storefront (W1), checkout and orders (W2), the seller side (W3) — renders
  inside it. The header is a client component; this layout is not, so the
  pages keep their own metadata and prerender.

  The root layout's fixed decorative overlay is hidden here the same way the
  reels layout hides it: a shop is drawn on its own canvas.
*/
export const metadata: Metadata = {
  title: { default: "MStore", template: "%s · MStore" },
  description: "Shop on MStore.",
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopFrame>
      <style>{`body > div:first-child > .pointer-events-none.fixed { display: none !important; }`}</style>
      {children}
    </ShopFrame>
  )
}
