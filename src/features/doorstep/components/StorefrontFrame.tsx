"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUpRight, Bell, CalendarDays, CircleDollarSign, Compass, Headphones, House, MapPin, Menu, MessageCircle, Search, X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ProfileDropdown } from "@/features/reels/components/ProfileDropdown"
import { PortalLink } from "@/components/auth/PortalLink"
import { useNotificationStream, useUnreadCount } from "@/hooks/useActivityNotifications"
import { DoorstepHeaderLocation } from "./DoorstepHeaderLocation"
import "../storefront.css"
import "../booking-journey.css"
import "../home-services-theme.css"

const links = [
  { href: "/doorstep", label: "Home services", icon: House },
  { href: "/doorstep/bookings", label: "My bookings", icon: CalendarDays },
  { href: "/doorstep/addresses", label: "Addresses", icon: MapPin },
  { href: "/doorstep/outstanding", label: "Dues", icon: CircleDollarSign },
]

export function StorefrontFrame({ children, needsLocation, duesCount }: { children: ReactNode; needsLocation: boolean; duesCount: number }) {
  useNotificationStream()
  const pathname = usePathname()
  const router = useRouter()
  const unread = useUnreadCount()
  return <StorefrontFrameView pathname={pathname} duesCount={duesCount} unreadCount={unread.data?.count ?? 0} profile={<ProfileDropdown />} search={<StorefrontSearch onSearch={query => router.push(`/doorstep?${new URLSearchParams({ q: query })}#doorstep-categories`)} />} location={needsLocation ? <DoorstepHeaderLocation /> : <Link className="dsc-link" href="/doorstep"><MapPin size={17} aria-hidden /><span>Browse nearby services</span></Link>}>{children}</StorefrontFrameView>
}

export function StorefrontSearch({ onSearch }: { onSearch?: (query: string) => void }) {
  return <form role="search" aria-label="Find home services" className="dsc-header-search" action="/doorstep" method="get" onSubmit={event => { if (onSearch) { event.preventDefault(); onSearch(String(new FormData(event.currentTarget).get("q") ?? "").trim()) } }}><Search size={17} aria-hidden /><input name="q" type="search" maxLength={120} aria-label="Search services" placeholder="Search for services, e.g. AC repair, cleaning…" /><button type="submit" aria-label="Find services"><ArrowUpRight size={16} aria-hidden /></button></form>
}

export function storefrontLinkIsCurrent(pathname: string, href: string) {
  return href === "/doorstep"
    ? pathname === href || pathname === "/doorstep/checkout" || pathname.startsWith("/doorstep/c/") || pathname.startsWith("/doorstep/s/")
    : pathname === href || pathname.startsWith(href + "/")
}

export function StorefrontFrameView({ children, pathname, duesCount, unreadCount, location, profile, search = <StorefrontSearch /> }: { children: ReactNode; pathname: string; duesCount: number; unreadCount: number; location: ReactNode; profile: ReactNode; search?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!sidebar.current?.contains(target) && !menuButton.current?.contains(target)) setMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus() }
    }
    const desktop = window.matchMedia("(min-width: 1101px)")
    const resize = () => { if (desktop.matches) setMenuOpen(false) }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    desktop.addEventListener("change", resize)
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); desktop.removeEventListener("change", resize) }
  }, [menuOpen])
  const closeMenu = () => setMenuOpen(false)
  return <div className="ds-storefront ds-home-services" data-doorstep-design="home-services-20261009">
    <a className="dsc-skip" href="#doorstep-content">Skip to content</a>
    <header className="dsc-header"><div className="dsc-header__inner">
      <button ref={menuButton} type="button" className="dsc-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-controls="doorstep-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}</button>
      <Link className="dsc-brand" href="/doorstep" aria-label="Doorstep home" title="Doorstep home" onClick={closeMenu}><House className="dsc-brand__icon" size={20} strokeWidth={1.8} aria-hidden /><span>Doorstep</span></Link>
      <div className="dsc-header__location">{location}</div>
      <div className="dsc-header__search">{search}</div>
      <div className="dsc-header__actions"><Link className="dsc-header__notification" href="/notifications" onClick={closeMenu} aria-label={unreadCount > 0 ? "Notifications, unread items" : "Notifications"}><Bell size={20} aria-hidden />{unreadCount > 0 && <span />}</Link>{profile}</div>
    </div></header>
    <div className="dsc-layout">
    <nav ref={sidebar} id="doorstep-navigation" className={`dsc-sidebar${menuOpen ? " is-open" : ""}`} aria-label="Doorstep navigation">
      <div className="dsc-sidebar__search" onSubmit={closeMenu}>{search}</div>
      <p className="dsc-sidebar__heading">HOME SERVICES</p>
      <ul>{links.map(({ href, label, icon: Icon }) => <li key={href}><Link href={href} onClick={closeMenu} aria-current={storefrontLinkIsCurrent(pathname, href) ? "page" : undefined}><Icon size={19} aria-hidden /><span>{label}</span>{href.endsWith("outstanding") && duesCount > 0 ? <span className="dsc-count" aria-label={`${duesCount} outstanding dues`}>{duesCount}</span> : null}</Link></li>)}</ul>
      <ul className="dsc-sidebar__secondary"><li><PortalLink href="/apps" onClick={closeMenu}><Compass size={19} aria-hidden /><span>All apps</span></PortalLink></li><li><Link href="/messenger" onClick={closeMenu}><MessageCircle size={19} aria-hidden /><span>Messenger</span></Link></li><li><Link href="/grievance" onClick={closeMenu}><Headphones size={19} aria-hidden /><span>Support</span></Link></li></ul>
    </nav>
    <div className="dsc-content-column"><main id="doorstep-content" tabIndex={-1} className="dsc-main">{children}</main>
    <footer className="dsc-footer"><div><Link className="dsc-footer__brand" href="/doorstep">Doorstep <small>by Cleestudio</small></Link><div><Link href="/doorstep/bookings">Booking help</Link><PortalLink href="/doorstep/partner" signInAs="doorstep-partner">Become a partner <ArrowUpRight size={15} aria-hidden /></PortalLink><PortalLink href="/apps">Explore apps</PortalLink></div></div></footer>
    </div></div>
  </div>
}
