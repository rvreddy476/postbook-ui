"use client"

import { Suspense, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { Bell, Headphones, House, Menu, X } from "lucide-react"
import { ProfileDropdown } from "@/features/reels/components/ProfileDropdown"
import { PartnerBusinessMenu } from "@/features/partners/PartnerBusinessMenu"
import { useNotificationStream, useUnreadCount } from "@/hooks/useActivityNotifications"
import "./workspace.css"
import "./partner-theme.css"

export function PartnerFrame({ children }: { children: ReactNode }) {
  const unread = useUnreadCount()
  useNotificationStream()
  return <PartnerFrameView unreadCount={unread.data?.count ?? 0} profile={<ProfileDropdown />} navigation={close => <Suspense fallback={<li role="status">Loading businesses…</li>}><PartnerBusinessMenu onNavigate={close} /></Suspense>}>{children}</PartnerFrameView>
}

/** The shell stays independent of account data; business access comes from the existing menu. */
export function PartnerFrameView({ children, profile, navigation, unreadCount = 0 }: { children: ReactNode; profile: ReactNode; navigation: (close: () => void) => ReactNode; unreadCount?: number }) {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  return <div className="dsp-shell dsp-home-style" data-doorstep-partner-design="home-services-partner-20261009">
    <a className="dsp-skip" href="#partner-content">Skip to workspace</a>
    <header className="dsp-header">
      <Link href="/doorstep/partner" className="dsp-brand" aria-label="Doorstep partner dashboard"><span><House size={24} strokeWidth={1.8} aria-hidden /></span><div>Doorstep<small>PARTNER PORTAL</small></div></Link>
      <div className="dsp-header__context"><span>Home services</span><span aria-hidden>/</span><strong>Partner workspace</strong></div>
      <div className="dsp-header__actions"><Link href="/grievance" className="dsp-header-help"><Headphones size={18} aria-hidden /><span>Help</span></Link><Link className="dsp-notification-bell" href="/doorstep/partner?tab=notifications" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}><Bell size={21} aria-hidden />{unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link>{profile}<button ref={menuButton} type="button" className="dsp-menu-toggle" aria-label={open ? "Close business menu" : "Open business menu"} aria-controls="partner-navigation" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? <X size={21} /> : <Menu size={21} />}</button></div>
    </header>
    <div className="dsp-layout">
      <nav id="partner-navigation" className={`dsp-navigation${open ? " is-open" : ""}`} aria-label="Partner businesses" onKeyDown={event => { if (event.key === "Escape" && open) { setOpen(false); menuButton.current?.focus() } }}>
        <p className="dsp-nav-label">YOUR WORKSPACE</p>
        <ul>{navigation(() => setOpen(false))}</ul>
        <div className="dsp-nav-footer"><span className="dsp-nav-dot" />Home services partner<p>One place for your services and work.</p></div>
      </nav>
      <main id="partner-content" tabIndex={-1} className="dsp-content"><div className="dsp-content__inner">{children}</div></main>
    </div>
  </div>
}
