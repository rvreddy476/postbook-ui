"use client"

/*
  The Feast customer frame: a compact header (brand, then Addresses, Cart,
  Orders — alphabetical) and the page. Each customer page renders inside it;
  the /feast/kitchen console has its own frame.
*/

import { ChefHat, MapPin, Package, ShoppingBag, UtensilsCrossed } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import "../feast.css"

import { useCart } from "../hooks/queries"

const LINKS = [
  { label: "Addresses", href: "/feast/addresses", icon: MapPin },
  { label: "Cart", href: "/feast/cart", icon: ShoppingBag },
  { label: "For restaurants", href: "/feast/kitchen", icon: ChefHat },
  { label: "Orders", href: "/feast/orders", icon: Package },
] as const

export function FeastFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const cart = useCart()
  const count = (cart.data?.items ?? []).reduce((n, i) => n + i.quantity, 0)

  return (
    <div className="fc-zone">
      {/* The root layout's decorative overlay is hidden here, as the shop and reels zones do. */}
      <style>{`body > div:first-child > .pointer-events-none.fixed { display: none !important; }`}</style>
      <header className="fc-header">
        <div className="fc-header__bar">
          <Link href="/feast" className="fc-brand">
            <UtensilsCrossed size={18} aria-hidden="true" />
            Feast
          </Link>
          <nav className="fc-nav" aria-label="Feast">
            {LINKS.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} className="fc-nav__link" aria-current={pathname?.startsWith(href) ? "page" : undefined} aria-label={label === "Cart" && count ? `Cart, ${count} items` : label}>
                <Icon size={16} aria-hidden="true" />
                <span className="fc-nav__label">{label}</span>
                {label === "Cart" && count ? <span className="fc-nav__count" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="fc-main">{children}</main>
    </div>
  )
}
