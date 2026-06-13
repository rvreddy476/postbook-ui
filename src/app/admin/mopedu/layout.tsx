"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AlertTriangle,
  BarChart3,
  CarFront,
  Coins,
  FileBadge2,
  History,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  ScrollText,
  Siren,
  Timer,
  Users,
} from "lucide-react"

import { useAuthUser } from "@/store/auth"

interface NavLink {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_LINKS: NavLink[] = [
  { href: "/admin/mopedu", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/mopedu/partners", label: "Partners", icon: Users },
  { href: "/admin/mopedu/documents", label: "Documents", icon: FileBadge2 },
  { href: "/admin/mopedu/vehicles", label: "Vehicles", icon: CarFront },
  { href: "/admin/mopedu/payments", label: "Payments", icon: Coins },
  { href: "/admin/mopedu/live-rides", label: "Live Rides", icon: Siren },
  { href: "/admin/mopedu/rides", label: "Ride History", icon: History },
  { href: "/admin/mopedu/complaints", label: "Complaints", icon: LifeBuoy },
  { href: "/admin/mopedu/safety", label: "Safety", icon: AlertTriangle },
  { href: "/admin/mopedu/geo", label: "Geo", icon: MapPinned },
  { href: "/admin/mopedu/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/mopedu/cron-runs", label: "Cron runs", icon: Timer },
  { href: "/admin/mopedu/audit", label: "Audit", icon: ScrollText },
]

function isLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === "/admin/mopedu") {
    return pathname === "/admin/mopedu" || pathname === "/admin/mopedu/"
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function activeSectionLabel(pathname: string | null): string {
  if (!pathname) return "Mopedu Admin"
  // Pick the most-specific match.
  const match = [...NAV_LINKS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((link) => isLinkActive(pathname, link.href))
  return match?.label ?? "Mopedu Admin"
}

// The User shape doesn't expose a role today; we soft-check a few common shapes
// so the gate becomes meaningful as soon as identity adds an `admin_role` or
// `roles` field. For now, fail-open: the gateway also enforces `X-Admin-Role`,
// so a non-admin who reaches this UI still gets 403 from the backend.
function userHasAdminRole(user: unknown): boolean {
  if (!user || typeof user !== "object") return false
  const u = user as Record<string, unknown>
  if (typeof u.admin_role === "string" && u.admin_role.length > 0) return true
  if (typeof u.role === "string" && u.role === "admin") return true
  if (Array.isArray(u.roles)) {
    return u.roles.some(
      (r) =>
        typeof r === "string" &&
        (r === "admin" || r === "superadmin" || r.startsWith("rider:admin")),
    )
  }
  return false
}

export default function MopeduAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const user = useAuthUser()

  // Soft gate: only show "access denied" when we explicitly have a non-admin
  // session. If identity hasn't surfaced any role info, defer to the backend.
  const userKnown = !!user
  const explicitlyDenied = userKnown && !userHasAdminRole(user)

  if (explicitlyDenied) {
    return (
      <main className="min-h-screen bg-brand-bg">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="w-full rounded-3xl border border-rose-200 bg-rose-50 px-8 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-rose-900">Access denied</h1>
            <p className="mt-2 text-sm text-rose-800/80">
              You need an admin role to view the Mopedu console. Ask the
              platform team to grant <code>rider:admin</code> on your account.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const sectionLabel = activeSectionLabel(pathname)

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-6 rounded-2xl border border-brand-divider bg-brand-card px-3 py-4 shadow-sm">
            <div className="px-2 pb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-text/45">
                Internal Console
              </p>
              <p className="mt-1 text-lg font-bold text-brand-text">Mopedu</p>
            </div>
            <nav className="space-y-1">
              {NAV_LINKS.map((link) => {
                const active = isLinkActive(pathname, link.href)
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      active
                        ? "flex items-center gap-2 rounded-xl bg-brand-secondary/30 px-3 py-2 text-sm font-semibold text-brand-text"
                        : "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-text/70 hover:bg-brand-secondary/20 hover:text-brand-text"
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {/* Mobile-only inline nav */}
          <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 md:hidden">
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(pathname, link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? "shrink-0 rounded-full bg-brand-text px-3 py-1.5 text-xs font-semibold text-white"
                      : "shrink-0 rounded-full border border-brand-divider px-3 py-1.5 text-xs text-brand-text/70"
                  }
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <header className="mb-5 rounded-2xl border border-brand-divider bg-brand-card px-5 py-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-text/45">
              Mopedu admin
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-brand-text">
              {sectionLabel}
            </h1>
          </header>

          {children}
        </section>
      </div>
    </main>
  )
}
