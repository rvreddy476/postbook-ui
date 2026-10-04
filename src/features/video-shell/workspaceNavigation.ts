import { BarChart3, Bike, CarFront, ChefHat, Coins, FileBadge2, History, LayoutDashboard, LifeBuoy, MapPin, MapPinned, ScrollText, ShieldCheck, ShoppingBag, Siren, Timer, Users, UtensilsCrossed, Package, type LucideIcon } from "lucide-react"

export interface WorkspaceLink { label: string; href: string; icon: LucideIcon; count?: number }
export const FOOD_LINKS: readonly WorkspaceLink[] = [
  { label: "Discover food", href: "/feast", icon: UtensilsCrossed },
  { label: "Your cart", href: "/feast/cart", icon: ShoppingBag },
  { label: "Orders", href: "/feast/orders", icon: Package },
  { label: "Addresses", href: "/feast/addresses", icon: MapPin },
  { label: "Kitchen workspace", href: "/feast/kitchen", icon: ChefHat },
]
export const ADMIN_LINKS: readonly WorkspaceLink[] = [
  { label: "Platform overview", href: "/admin", icon: LayoutDashboard },
  { label: "Mopedu operations", href: "/admin/mopedu", icon: Bike },
  { label: "Dating safety", href: "/admin/dating", icon: ShieldCheck },
]
export const DATING_ADMIN_LINKS: readonly WorkspaceLink[] = [
  { label: "Safety overview", href: "/admin/dating", icon: LayoutDashboard },
  { label: "Reports", href: "/admin/dating/reports", icon: LifeBuoy },
  { label: "Panic events", href: "/admin/dating/panic", icon: Siren },
  { label: "Photo review", href: "/admin/dating/photos", icon: FileBadge2 },
  { label: "Audit trail", href: "/admin/dating/audit", icon: ScrollText },
]
export const MOPEDU_LINKS: readonly WorkspaceLink[] = [
  { label: "Overview", href: "/admin/mopedu", icon: LayoutDashboard },
  { label: "Partners", href: "/admin/mopedu/partners", icon: Users },
  { label: "Documents", href: "/admin/mopedu/documents", icon: FileBadge2 },
  { label: "Vehicles", href: "/admin/mopedu/vehicles", icon: CarFront },
  { label: "Payments", href: "/admin/mopedu/payments", icon: Coins },
  { label: "Live rides", href: "/admin/mopedu/live-rides", icon: Siren },
  { label: "Ride history", href: "/admin/mopedu/rides", icon: History },
  { label: "Complaints", href: "/admin/mopedu/complaints", icon: LifeBuoy },
  { label: "Safety", href: "/admin/mopedu/safety", icon: ShieldCheck },
  { label: "Service areas", href: "/admin/mopedu/geo", icon: MapPinned },
  { label: "Reports", href: "/admin/mopedu/reports", icon: BarChart3 },
  { label: "Scheduled jobs", href: "/admin/mopedu/cron-runs", icon: Timer },
  { label: "Audit trail", href: "/admin/mopedu/audit", icon: ScrollText },
]
export function workspaceLinkCurrent(path: string, href: string, links: readonly WorkspaceLink[]): boolean {
  const matches = links.filter(link => path === link.href || path.startsWith(`${link.href}/`)).sort((a,b) => b.href.length-a.href.length)
  return matches[0]?.href === href
}
