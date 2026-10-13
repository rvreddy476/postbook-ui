"use client"

/*
  Feast uses the shared Reels shell with its own customer navigation.
  Kitchen keeps its permission checks and work tabs inside the same chrome.
*/

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { CurrentLocationBoundary, CurrentLocationBar } from "@/features/maps/CurrentLocation"
import { locationRequired } from "@/features/maps/locationController"
import { ChefHat } from "lucide-react"

import "../feast.css"

import { useCart } from "../hooks/queries"
import { WorkspaceShell } from "@/features/video-shell/WorkspaceShell"
import { FOOD_LINKS } from "@/features/video-shell/workspaceNavigation"

export function FeastFrame({ children }: { children: ReactNode }) {
  const cart = useCart()
  const needsLocation = locationRequired(usePathname(), "feast")
  const count = (cart.data?.items ?? []).reduce((n, i) => n + i.quantity, 0)

  return (
    <WorkspaceShell kind="feast" title="Good food, your way" links={FOOD_LINKS.map(link => link.href === "/feast/cart" ? {...link,count} : link)}>
    <div className="fc-zone">
      {/* The root layout's decorative overlay is hidden here, as the shop and reels zones do. */}
      <style>{`body > div:first-child > .pointer-events-none.fixed { display: none !important; }`}</style>
      <section className="fc-main">{needsLocation ? <CurrentLocationBoundary><CurrentLocationBar />{children}</CurrentLocationBoundary> : children}</section>
    </div>
    </WorkspaceShell>
  )
}

export function FeastKitchenFrame({ children }: { children: ReactNode }) {
  return <WorkspaceShell kind="kitchen" title="Restaurant workspace" links={[{ label: "My restaurant", href: "/feast/kitchen", icon: ChefHat }]}><div className="kit-zone">{children}</div></WorkspaceShell>
}
