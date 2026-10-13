"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useContext, useRef, type ComponentProps } from "react"
import { QueryClientContext } from "@tanstack/react-query"
import { beginPortalSwitch } from "./portalSwitch"
import { clearPortalSession } from "./clearPortalSession"
import { useAuthUser } from "@/store/auth"
import { usePartnerPortal } from "./usePartnerPortal"
import { portalEntryHref, roleChooserHref, portalLoginHref, type PortalRoleId } from "./portalRoles"

/** Sign-in links explicitly end the current browser session; workspace links do so only when changing sides. */
export function PortalLink({ href, signInAs, onClick, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string; signInAs?: PortalRoleId }) {
  const path = usePathname() || "/"
  const user = useAuthUser()
  const partnerPortal = usePartnerPortal()
  const query = useContext(QueryClientContext)
  const locked = useRef(false)
  const target = signInAs ? user ? roleChooserHref(path, signInAs) : portalLoginHref(signInAs) : portalEntryHref(path, href, Boolean(user), partnerPortal)
  const switching = target.startsWith("/api/postmatch/auth/logout?")
  return <Link {...props} href={target} prefetch={switching ? false : props.prefetch} onClick={event => {
    onClick?.(event)
    if (!switching || event.defaultPrevented) return
    event.preventDefault()
    if (locked.current) return
    locked.current = true
    const id = new URLSearchParams(target.split("?")[1]).get("portal")
    beginPortalSwitch(id, { signedIn: Boolean(user), cancelQueries: () => { void query?.cancelQueries() }, clearQueries: () => query?.clear(), prepareLogout: clearPortalSession, navigate: url => window.location.assign(url) })
  }} />
}
