"use client"

/*
  Doorstep uses the shared workspace chrome (the Reels shell, as Feast and
  Pulse do) with its own customer navigation. WorkspaceShell's `kind` and the
  app-brand table do not list Doorstep yet, so the frame composes the same
  parts with Doorstep's own brand rather than editing those shared files.
*/

import { CalendarCheck, CircleDollarSign, House, MapPin, Wrench } from "lucide-react"
import type { ReactNode } from "react"

import "../doorstep.css"

import { HeaderBar } from "@/features/reels/components/HeaderBar"
import { VideoShell } from "@/features/video-shell/VideoShell"
import { WorkspaceNavigation } from "@/features/video-shell/WorkspaceShell"
import type { WorkspaceLink } from "@/features/video-shell/workspaceNavigation"
import type { AppBrand } from "@/lib/appBrand"

import "@/features/video-shell/workspace.css"

import { useOutstanding } from "../hooks/queries"

export const DOORSTEP_BRAND: AppBrand = {
  key: "doorstep",
  name: "Doorstep",
  href: "/doorstep",
  icon: House,
  searchPlaceholder: "Search home services...",
  prefixes: ["/doorstep"],
}

/** The menu, alphabetical. */
export const DOORSTEP_LINKS: readonly WorkspaceLink[] = [
  { label: "Addresses", href: "/doorstep/addresses", icon: MapPin },
  { label: "Book a service", href: "/doorstep", icon: Wrench },
  { label: "Bookings", href: "/doorstep/bookings", icon: CalendarCheck },
  { label: "Dues", href: "/doorstep/outstanding", icon: CircleDollarSign },
]

export function DoorstepFrame({ children }: { children: ReactNode }) {
  const dues = useOutstanding()
  const count = dues.data?.bills.length ?? 0
  const links = DOORSTEP_LINKS.map((l) => (l.href === "/doorstep/outstanding" && count ? { ...l, count } : l))
  return (
    <div className="service-workspace" data-workspace="doorstep">
      <a className="workspace-skip" href="#workspace-content">
        Skip to content
      </a>
      <VideoShell
        app="workspace"
        header={<HeaderBar hideSearch hideCreate brand={DOORSTEP_BRAND} />}
        navigation={(props) => <WorkspaceNavigation {...props} links={links} title="Home services" />}
      >
        <div id="workspace-content" tabIndex={-1} className="workspace-content">
          <div className="ds-zone">
            <section className="ds-main">{children}</section>
          </div>
        </div>
      </VideoShell>
    </div>
  )
}
