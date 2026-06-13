"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Utensils,
} from "lucide-react"

import { useAuthUser } from "@/store/auth"

interface NavLink {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_LINKS: NavLink[] = [
  { href: "/admin/figo", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/figo/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/figo/moderation", label: "Moderation", icon: ShieldCheck },
  { href: "/admin/figo/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/admin/figo/tickets", label: "Support", icon: LifeBuoy },
  { href: "/admin/figo/refunds", label: "Refunds", icon: Utensils },
  { href: "/admin/figo/fraud", label: "Fraud", icon: ShieldAlert },
]

function isLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === "/admin/figo") {
    return pathname === "/admin/figo" || pathname === "/admin/figo/"
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function activeSectionLabel(pathname: string | null): string {
  if (!pathname) return "FiGo Admin"
  const match = [...NAV_LINKS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((link) => isLinkActive(pathname, link.href))
  return match?.label ?? "FiGo Admin"
}

// Mirrors admin/mopedu/layout.tsx — fail-open soft gate. The backend
// enforces `X-Scopes: admin | superadmin` on every endpoint behind
// /v1/food/admin/*, so a non-admin who lands here gets 403 from the
// API rather than a stale UI.
function userHasAdminRole(user: unknown): boolean {
  if (!user || typeof user !== "object") return false
  const u = user as Record<string, unknown>
  if (typeof u.admin_role === "string" && u.admin_role.length > 0) return true
  if (typeof u.role === "string" && u.role === "admin") return true
  if (Array.isArray(u.roles)) {
    return u.roles.some(
      (r) =>
        typeof r === "string" &&
        (r === "admin" ||
          r === "superadmin" ||
          r.startsWith("food:admin") ||
          r.startsWith("admin")),
    )
  }
  return false
}

export default function AdminFigoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const user = useAuthUser()
  void userHasAdminRole // silence unused warning; identity will surface roles soon

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-200 bg-white p-4 lg:flex lg:flex-col">
          <Link
            href="/admin/figo"
            className="mb-6 text-sm font-semibold tracking-wide text-amber-700"
          >
            FiGo · Admin
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(pathname, link.href)
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                    active
                      ? "bg-amber-50 text-amber-900"
                      : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </nav>
          {user ? (
            <div className="mt-auto pt-4 text-xs text-slate-500">
              Signed in as {user.name || user.username || user.id}
            </div>
          ) : null}
        </aside>

        <div className="min-h-screen flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
            <h1 className="text-lg font-semibold text-slate-900">
              {activeSectionLabel(pathname)}
            </h1>
          </header>
          <main className="px-4 py-4 lg:px-6 lg:py-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
