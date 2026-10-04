"use client"
import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getSession } from "@/services/authService"
import NotificationToastHost from "@/components/notifications/NotificationToastHost"
import { WorkspaceShell } from "./WorkspaceShell"
import { ADMIN_LINKS, DATING_ADMIN_LINKS, MOPEDU_LINKS } from "./workspaceNavigation"

/** Preserve the old Admin AppShell's signed-in gate; API permissions remain authoritative. */
export function AdminWorkspace({ children }: { children: ReactNode }) {
  const router = useRouter()
  const path = usePathname() || "/admin"
  const [ready,setReady] = useState(false)
  useEffect(() => {
    const sync = () => { const signedIn = !!getSession(); setReady(signedIn); if (!signedIn) router.replace("/login") }
    sync()
    window.addEventListener("postbook:session-changed",sync)
    return () => window.removeEventListener("postbook:session-changed",sync)
  }, [router])
  if (!ready) return <div className="min-h-screen" role="status" aria-label="Checking access" />
  const mopedu = path.startsWith("/admin/mopedu")
  const dating = path.startsWith("/admin/dating")
  const links = mopedu ? [...MOPEDU_LINKS,ADMIN_LINKS[0]] : dating ? [...DATING_ADMIN_LINKS,ADMIN_LINKS[0]] : ADMIN_LINKS
  return <WorkspaceShell kind={mopedu ? "mopedu" : "admin"} title={mopedu ? "Mopedu operations" : dating ? "Dating safety" : "Platform operations"} links={links}>
    <div className="workspace-admin">{children}</div>
    <NotificationToastHost />
  </WorkspaceShell>
}
