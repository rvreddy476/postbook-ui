"use client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { isPartnerHost } from "./partnerPortal"
export function usePartnerPortal() {
  const path = usePathname() ?? "/"
  const [hostIsPartner, setHostIsPartner] = useState(false)
  useEffect(() => setHostIsPartner(isPartnerHost(window.location.hostname)), [])
  return hostIsPartner || path === "/partners" || path.startsWith("/partners/")
}
