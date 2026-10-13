"use client"

/*
  Customer and partner pages have separate light-theme shells.
  Authentication, registered-business navigation and onboarding rules are unchanged.
*/

import { CalendarCheck, CircleDollarSign, House, MapPin, Wrench } from "lucide-react"
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { CurrentLocationBoundary, CurrentLocationGate } from "@/features/maps/CurrentLocation"
import { locationRequired } from "@/features/maps/locationController"
import { NearbyServices } from "./NearbyServices"
import { StorefrontFrame } from "./StorefrontFrame"

import "../doorstep.css"
import "../partner/partner.css"

import { PartnerFrame } from "../partner/PartnerFrame"
import type { WorkspaceLink } from "@/features/video-shell/workspaceNavigation"
import type { AppBrand } from "@/lib/appBrand"


import { useOutstanding } from "../hooks/queries"
import { useAuthUser } from "@/store/auth"

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

export function DoorstepFrame({ children, partner = false }: { children: ReactNode; partner?: boolean }) {
  const user = useAuthUser()
  const pathname = usePathname()
  const needsLocation = !partner && locationRequired(pathname, "doorstep")
  const dues = useOutstanding(Boolean(user) && !partner)
  const count = user && !partner ? dues.data?.bills.length ?? 0 : 0
  if (!partner) {
    const customer = <StorefrontFrame needsLocation={needsLocation} duesCount={count}>{needsLocation ? <CurrentLocationGate><NearbyServices>{children}</NearbyServices></CurrentLocationGate> : children}</StorefrontFrame>
    return needsLocation ? <CurrentLocationBoundary gate={false}>{customer}</CurrentLocationBoundary> : customer
  }
  return <PartnerFrame>{children}</PartnerFrame>
}
