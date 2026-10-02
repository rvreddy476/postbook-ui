import type { Metadata } from "next"

import { DatingFrame } from "@/features/dating/components/DatingFrame"
import "@/features/dating/dating.css"

/*
  The Pulse zone: its own header and tabs, then <main>. Every /dating page
  renders inside it. The frame is a client component; this layout is not, so
  the pages keep their own metadata.

  The root layout's fixed decorative overlay is hidden here the same way the
  shop and reels layouts hide it.
*/
export const metadata: Metadata = {
  title: { default: "Pulse", template: "%s · Pulse" },
  description: "Pulse: meet people near you. Adults only.",
  robots: { index: false, follow: false },
}

export default function DatingLayout({ children }: { children: React.ReactNode }) {
  return (
    <DatingFrame>
      <style>{`body > div:first-child > .pointer-events-none.fixed { display: none !important; }`}</style>
      {children}
    </DatingFrame>
  )
}
