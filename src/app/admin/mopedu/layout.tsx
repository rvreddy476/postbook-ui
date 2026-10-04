"use client"
import { usePathname } from "next/navigation"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import { useAuthUser } from "@/store/auth"
import { MOPEDU_LINKS, workspaceLinkCurrent } from "@/features/video-shell/workspaceNavigation"

// Preserve the existing role check. All server-side permissions remain unchanged.
function userHasAdminRole(user: unknown): boolean {
  if (!user || typeof user !== "object") return false
  const u = user as Record<string,unknown>
  if (typeof u.admin_role === "string" && u.admin_role.length > 0) return true
  if (u.role === "admin") return true
  return Array.isArray(u.roles) && u.roles.some(r => typeof r === "string" && (r === "admin" || r === "superadmin" || r.startsWith("rider:admin")))
}
export default function MopeduAdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/admin/mopedu"
  const user = useAuthUser()
  if (user && !userHasAdminRole(user)) return <section className="workspace-denied" role="alert">
    <AlertTriangle size={32} aria-hidden/>
    <h1 className="text-2xl font-bold">Access denied</h1>
    <p className="mt-3 text-sm text-text-muted">You need an admin role to view the Mopedu console. Ask the platform team to grant <code>rider:admin</code> on your account.</p>
  </section>
  const label = MOPEDU_LINKS.find(link => workspaceLinkCurrent(path,link.href,MOPEDU_LINKS))?.label || "Overview"
  return <section>
    <header className="workspace-page-head">
      <span className="workspace-eyebrow"><ShieldCheck size={15} aria-hidden/>Mopedu operations</span>
      <h1>{label}</h1>
      <p>Manage ride operations, partner reviews, and service safety.</p>
    </header>
    {children}
  </section>
}
