"use client"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowRight, Bike, BriefcaseBusiness, House, ShoppingBag, Truck, Utensils } from "lucide-react"
import { useAuthUser } from "@/store/auth"
import { HeaderBar } from "@/features/reels/components/HeaderBar"
import { VideoShell } from "@/features/video-shell/VideoShell"
import { WorkspaceNavigation } from "@/features/video-shell/WorkspaceShell"
import { BusinessPartnerSelect } from "@/components/auth/BusinessPartnerSelect"
import { PARTNER_MENU, portalRole } from "@/components/auth/portalRoles"
import { businessSelections, type BusinessPartnerId } from "@/components/auth/partnerPortal"
import "@/components/auth/partnerPortal.css"

const icons = { "shop-partner": ShoppingBag, "feast-partner": Utensils, "ride-partner": Bike, "delivery-partner": Truck, "doorstep-partner": House }
export function PartnerHub() {
  const user = useAuthUser()
  const search = useSearchParams()
  return user ? <PartnerAccount key={user.id} userId={user.id} initial={businessSelections(search.get("businesses"))} /> : <div className="partner-hub"><p role="status">Loading your partner account…</p></div>
}
function PartnerAccount({ userId, initial }: { userId: string; initial: BusinessPartnerId[] }) {
  const [selected, setSelected] = useState<BusinessPartnerId[]>(initial)
  const [ready, setReady] = useState(false)
  const key = `partner-business-intents:${userId}`
  useEffect(() => {
    try { setSelected(businessSelections([...initial, ...businessSelections(localStorage.getItem(key))].join(","))) } catch { /* Selection still works without storage. */ }
    setReady(true)
  }, [key]) // Initial query is a navigation intent, never authorization.
  useEffect(() => {
    if (ready) try { localStorage.setItem(key, selected.join(",")) } catch { /* Nothing security-sensitive is stored here. */ }
  }, [key, ready, selected])
  const choices = selected.length ? PARTNER_MENU.filter(item => selected.includes(item.id)) : PARTNER_MENU
  return <div className="partner-hub"><VideoShell app="workspace" header={<HeaderBar hideSearch hideCreate brand={{ key: "partners", name: "Clee Partners", href: "/partners", icon: BriefcaseBusiness, searchPlaceholder: "", prefixes: ["/partners"] }} />} navigation={props => <WorkspaceNavigation {...props} partner title="Partner workspace" links={[]} />}>
    <main className="partner-hub__content"><h1>Your businesses. One partner account.</h1><p>Choose the workspaces you need. Complete each business's own details and verification before you can start operating.</p>
      <div className="partner-hub__selection"><BusinessPartnerSelect value={selected} onChange={setSelected} /><p>You can add more business types at any time. Choosing a type doesn't submit or approve an application.</p></div>
      <section className="partner-hub__grid" aria-label="Business applications">{choices.map(item => { const Icon = icons[item.id]; return <article className="partner-hub__card" key={item.id}><Icon size={28} aria-hidden="true" /><h2>{item.label}</h2><p>{item.detail}. Open your workspace to start or continue your application.</p><Link href={portalRole(item.id)!.href}>Start or continue setup<ArrowRight size={17} aria-hidden="true" /></Link></article> })}</section>
    </main>
  </VideoShell></div>
}
