"use client"

import { useContext, useEffect, useRef, useState } from "react"
import { QueryClientContext } from "@tanstack/react-query"
import { BriefcaseBusiness, ChevronDown, ArrowUpRight } from "lucide-react"
import { clearPortalSession } from "./clearPortalSession"
import { PARTNER_MENU, portalRole } from "./portalRoles"
import { isPartnerHost } from "./partnerPortal"
import { beginPortalSwitch } from "./portalSwitch"
import "./partners.css"

/** Shared by the signed-out auth header and every customer account menu. */
export function RoleMenuLink({ className = "partner-menu__trigger", onClick, menuItem = false, floating = false }: { className?: string; onClick?: () => void; menuItem?: boolean; floating?: boolean }) {
  const query = useContext(QueryClientContext)
  const element = useRef<HTMLDetailsElement>(null)
  const submitting = useRef(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        if (element.current?.open) { element.current.open = false; element.current.querySelector("summary")?.focus() }
      } else if (!(event instanceof KeyboardEvent) && !element.current?.contains(event.target as Node) && element.current) element.current.open = false
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close) }
  }, [])
  return <details ref={element} className={`partner-menu${floating ? " partner-menu--floating" : ""}`} onClick={event => event.stopPropagation()}>
    <summary className={className} role={menuItem ? "menuitem" : undefined} aria-label="Partner options"><BriefcaseBusiness size={16} aria-hidden="true" /><span>Partner</span><ChevronDown size={14} aria-hidden="true" /></summary>
    <div className="partner-menu__choices" aria-label="Partner options">
      <p>Choose your partner workspace</p>
      {PARTNER_MENU.map(item => <button type="button" key={item.id} aria-label={item.label} disabled={busy} onClick={() => {
        if (submitting.current) return
        if (isPartnerHost(window.location.hostname)) { onClick?.(); window.location.assign(portalRole(item.id)!.href); return }
        submitting.current = true
        setBusy(true)
        onClick?.()
        beginPortalSwitch(item.id, {
          signedIn: true,
          cancelQueries: () => { void query?.cancelQueries() },
          clearQueries: () => query?.clear(),
          prepareLogout: clearPortalSession,
          navigate: href => window.location.assign(href),
        })
      }}><span><strong>{item.label}</strong><small>{item.detail}</small></span><ArrowUpRight size={16} aria-hidden="true" /></button>)}
      <small className="partner-menu__note" role="status">{busy ? "Ending this session…" : "Selecting a partner signs you out of this session."}</small>
    </div>
  </details>
}
