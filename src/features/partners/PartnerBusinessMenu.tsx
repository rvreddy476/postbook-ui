"use client"
import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { BriefcaseBusiness, ChevronDown, House, ShoppingBag, Utensils, Bike, Truck } from "lucide-react"
import { PortalLink as Link } from "@/components/auth/PortalLink"
import { useAuthUser } from "@/store/auth"
import { partnerApi } from "@/features/doorstep/partner/api"
import { toDoorstepError } from "@/features/doorstep/api/client"
import { readProfile } from "./api"
import { isNoSeller } from "@/features/shop/model/sell"
import { fetchOnboardingStatus } from "@/features/shop/api/sell"
import { fetchCapabilitiesRaw } from "@/features/feast/kitchen/api/client"
import { decodeCapabilities } from "@/features/feast/kitchen/model/wire"
import { envelopeData } from "@/features/feast/kitchen/model/decode"
import { BUSINESS_SECTIONS, registeredBusinesses, sectionIsCurrent } from "./businessNavigation"
import "./businessNavigation.css"

const icons = [House, ShoppingBag, Utensils, Bike, Truck]
export function PartnerBusinessMenu({ expanded = true, onNavigate }: { expanded?: boolean; onNavigate?: () => void }) {
  const user = useAuthUser()
  const pathname = usePathname() || "/partners"
  const search = useSearchParams()
  const current = BUSINESS_SECTIONS.find(b => pathname === b.href || pathname.startsWith(b.href + "/"))?.id
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const query = useQuery({
    queryKey: ["partner-business-navigation", user?.id],
    enabled: !!user, staleTime: 60_000, gcTime: 0, retry: false, refetchOnWindowFocus: true,
    queryFn: async () => {
      const results = await Promise.allSettled([
        partnerApi.me().then(() => true).catch(e => { const failure = toDoorstepError(e); if (failure.status === 404 && failure.code === "DOORSTEP_PRO_NOT_FOUND") return false; throw e }),
        fetchOnboardingStatus().then(p => Boolean(p?.id)).catch(e => { if (isNoSeller(e)) return false; throw e }),
        fetchCapabilitiesRaw().then(raw => decodeCapabilities(envelopeData(raw)).isRestaurantOwner),
        readProfile("ride").then(Boolean),
        readProfile("delivery").then(Boolean),
      ])
      return { registered: registeredBusinesses(results), unavailable: results.some(r => r.status === "rejected") }
    },
  })
  return <>
    <li><Link href="/partners" onClick={onNavigate} className="video-nav__item" aria-label="All businesses"><BriefcaseBusiness size={20} className="video-nav__icon" /><span className="video-nav__label">All businesses</span></Link></li>
    {BUSINESS_SECTIONS.map((business, i) => {
      if (!query.data?.registered.includes(business.id) && current !== business.id) return null
      const Icon = icons[i], active = current === business.id
      const isOpen = open[business.id] ?? active
      return <li key={business.id} className="partner-business-menu">
        {expanded ? <button type="button" className={"video-nav__item partner-business-menu__toggle" + (active ? " is-current" : "")} aria-expanded={isOpen} onClick={() => setOpen({ ...open, [business.id]: !isOpen })}><Icon size={20} className="video-nav__icon" /><span>{business.label}</span><ChevronDown size={16} className={isOpen ? "is-open" : ""} /></button> : <Link href={business.href} className={"video-nav__item" + (active ? " is-current" : "")} title={business.label} aria-label={business.label} onClick={onNavigate}><Icon size={20} className="video-nav__icon" /></Link>}
        {expanded && isOpen && <ul className="partner-business-menu__sections">{business.sections.map(([label, suffix]) => {
          const href = business.href + suffix, selected = sectionIsCurrent(pathname, search.get("tab"), href)
          return <li key={href}><Link href={href} aria-current={selected ? "page" : undefined} className={selected ? "is-current" : ""} onClick={onNavigate}>{label}</Link></li>
        })}</ul>}
      </li>
    })}
    {expanded && query.isPending && <li className="partner-business-menu__note" role="status">Loading businesses…</li>}
    {expanded && query.data?.unavailable && <li className="partner-business-menu__note">Some businesses could not be loaded. <button type="button" onClick={() => void query.refetch()}>Retry</button></li>}
  </>
}
