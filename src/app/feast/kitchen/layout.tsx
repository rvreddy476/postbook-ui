import type { Metadata } from "next"

import "@/features/feast/kitchen/kitchen.css"

/*
  Feast Kitchen, the restaurant console. Its own canvas: the root layout's
  fixed decorative overlay is hidden here the way the shop and reels hide it.
  Signed-in only — middleware gates every route not listed as public, and
  /feast/kitchen is not listed.
*/
export const metadata: Metadata = {
  title: { default: "Feast Kitchen", template: "%s · Feast Kitchen" },
  description: "Take orders, run your menu and see your earnings on Feast.",
  robots: { index: false, follow: false },
}

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kit-zone">
      <style>{`body > div:first-child > .pointer-events-none.fixed { display: none !important; }`}</style>
      {children}
    </div>
  )
}
