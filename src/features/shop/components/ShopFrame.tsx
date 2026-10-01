"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Compass, CreditCard, Heart, MapPin, Monitor, Moon, Package, ShoppingBag, Store, Sun, X } from "lucide-react"
import { chooseTheme, readThemeChoice, type ThemeChoice } from "@/features/video-shell/themeChoice"
import { useShopSession } from "../hooks/storefront"
import { SHOP_BASE, STORE_NAME, signInHref } from "../model/storefront"
import { ShopHeader } from "./ShopHeader"

const LINKS = [
  { label: "Shop", href: SHOP_BASE, icon: Store, public: true },
  { label: "Explore products", href: `${SHOP_BASE}/browse`, icon: Compass, public: true },
  { label: "Favourites", href: `${SHOP_BASE}/favourites`, icon: Heart },
  { label: "Bag", href: `${SHOP_BASE}/bag`, icon: ShoppingBag },
  { label: "Orders", href: `${SHOP_BASE}/orders`, icon: Package },
  { label: "Addresses", href: `${SHOP_BASE}/addresses`, icon: MapPin },
  { label: "Payments", href: `${SHOP_BASE}/payments`, icon: CreditCard },
] as const

function Appearance() {
  const [choice, setChoice] = useState<ThemeChoice>("auto")
  useEffect(() => setChoice(readThemeChoice(localStorage)), [])
  const options = [{ value: "light", icon: Sun }, { value: "dark", icon: Moon }, { value: "auto", icon: Monitor }] as const
  return (
    <div className="shop-appearance" role="group" aria-label="Appearance">
      {options.map(({ value, icon: Icon }) => (
        <button key={value} type="button" aria-label={`${value.charAt(0).toUpperCase() + value.slice(1)} appearance`} aria-pressed={choice === value} title={`${value.charAt(0).toUpperCase() + value.slice(1)} appearance`} onClick={() => {
          chooseTheme(value, { storage: localStorage, root: document.documentElement, prefersDark: matchMedia("(prefers-color-scheme: dark)").matches })
          setChoice(value)
        }}><Icon size={17} aria-hidden="true" /></button>
      ))}
    </div>
  )
}

/** Commerce-specific navigation, with the same compact icon/label treatment as Reels. */
export function ShopFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { signedIn, known } = useShopSession()
  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const menu = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const media = matchMedia("(max-width: 767px)")
    const onChange = () => { setDrawer(media.matches); setOpen(false) }
    onChange()
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return }
      if (event.key !== "Tab") return
      const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])
      const first = targets[0], last = targets[targets.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKey)
      menu.current?.focus()
    }
  }, [open])

  const gated = (href: string) => known && !signedIn ? signInHref(href) : href
  return (
    <div className={`shop-zone${compact ? " shop-zone--compact" : ""}${open ? " shop-zone--menu-open" : ""}`}>
      <a href="#shop-content" className="shop-skip">Skip to products</a>
      <ShopHeader menuRef={menu} menuOpen={drawer ? open : !compact} onMenu={() => {
        if (drawer) setOpen(!open)
        else setCompact(!compact)
      }} />
      <div className="shop-frame">
        {open ? <button className="shop-scrim" type="button" aria-label="Close shop menu" onClick={() => setOpen(false)} /> : null}
        <aside ref={panel} id="shop-navigation" className="shop-sidebar" role={open ? "dialog" : undefined} aria-modal={open ? true : undefined} aria-label="Shop navigation">
          <div className="shop-sidebar__heading"><span>{STORE_NAME}</span><button type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button></div>
          <nav aria-label="Commerce">
            {LINKS.map(({ label, href, icon: Icon, ...entry }) => (
              <Link key={href} href={"public" in entry ? href : gated(href)} className="shop-nav-link" aria-label={label} title={label} aria-current={(href === SHOP_BASE ? pathname === href : pathname?.startsWith(href)) ? "page" : undefined} onClick={() => setOpen(false)}>
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="shop-sidebar__bottom">
            <Link href={gated(`${SHOP_BASE}/sell`)} className="shop-nav-link shop-nav-link--sell" aria-label={`Sell on ${STORE_NAME}`} title={`Sell on ${STORE_NAME}`}><Store size={20} aria-hidden="true" /><span>Seller workspace</span></Link>
            <Appearance />
          </div>
        </aside>
        <main id="shop-content" className="shop-main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  )
}
