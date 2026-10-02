"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Crown, Home, Layers, MessagesSquare, Settings, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react"

import { DATING_BASE } from "../model/profile"

export interface NavEntry {
  label: string
  href: string
  icon: LucideIcon
}

/** The three sections of home, alphabetical. */
export const PRIMARY_NAV: readonly NavEntry[] = [
  { label: "Deck", href: DATING_BASE, icon: Layers },
  { label: "Liked you", href: `${DATING_BASE}/sparks`, icon: Sparkles },
  { label: "Matches", href: `${DATING_BASE}/matches`, icon: MessagesSquare },
]

/** Everything else, alphabetical. */
export const MORE_NAV: readonly NavEntry[] = [
  { label: "Premium", href: `${DATING_BASE}/premium`, icon: Crown },
  { label: "Safety", href: `${DATING_BASE}/safety`, icon: ShieldCheck },
  { label: "Settings", href: `${DATING_BASE}/settings`, icon: Settings },
]

/** Setting up is one path: the tabs would only lead back to it. */
export function hidesNav(pathname: string): boolean {
  return pathname.startsWith(`${DATING_BASE}/onboarding`) || pathname.startsWith(`${DATING_BASE}/verify`)
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === DATING_BASE) return pathname === DATING_BASE || pathname.startsWith(`${DATING_BASE}/people`)
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DatingNav({ pathname }: { pathname: string }) {
  if (hidesNav(pathname)) return null
  const moreActive = MORE_NAV.some((e) => isCurrent(pathname, e.href))
  return (
    <nav className="pulse-nav" aria-label="Pulse">
      {PRIMARY_NAV.map(({ label, href, icon: Icon }) => (
        <Link key={href} href={href} className="pulse-nav__link" aria-current={isCurrent(pathname, href) ? "page" : undefined}>
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
      <details className="pulse-more">
        <summary className="pulse-nav__link" data-active={moreActive || undefined}>
          <span>More</span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <ul className="pulse-more__panel">
          {MORE_NAV.map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="pulse-more__item" aria-current={isCurrent(pathname, href) ? "page" : undefined}>
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  )
}

/** The Pulse zone: its own header and tabs, then <main>. */
export function DatingFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || DATING_BASE
  return (
    <div className="pulse-zone">
      <a href="#pulse-content" className="pulse-skip">
        Skip to content
      </a>
      <header className="pulse-top">
        <div className="pulse-top__row">
          <Link href={DATING_BASE} className="pulse-brand" aria-label="Pulse home">
            <Sparkles size={18} aria-hidden="true" />
            <span>Pulse</span>
          </Link>
          <Link href="/" className="pulse-top__exit" aria-label="Back to Momentum">
            <Home size={16} aria-hidden="true" />
            <span>Momentum</span>
          </Link>
        </div>
        <DatingNav pathname={pathname} />
      </header>
      <main id="pulse-content" className="pulse-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
