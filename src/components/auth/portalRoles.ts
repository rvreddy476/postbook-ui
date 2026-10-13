/** Portal choice is navigation, never an authorization claim. APIs still check membership/approval. */
export const PORTAL_ROLES = [
  { id: "customer", label: "Customer", app: "VChat", href: "/", detail: "Browse all apps with your personal account." },
  { id: "doorstep-customer", label: "Customer", app: "Doorstep", href: "/doorstep", detail: "Book and manage home services." },
  { id: "doorstep-partner", label: "Professional partner", app: "Doorstep", href: "/doorstep/partner", detail: "Manage your application, services and working hours." },
  { id: "shop-customer", label: "Shopper", app: "MStore", href: "/shop", detail: "Shop products and manage your orders." },
  { id: "shop-partner", label: "Seller", app: "MStore", href: "/shop/sell", detail: "Manage your seller account, products and orders." },
  { id: "feast-customer", label: "Customer", app: "Feast", href: "/feast", detail: "Discover food and manage your orders." },
  { id: "feast-partner", label: "Restaurant partner", app: "Feast", href: "/feast/kitchen", detail: "Open the kitchen workspace. Restaurant access is required." },
  { id: "ride-partner", label: "Ride Partner", app: "Mopedu", href: "/mopedu/partner", detail: "Driver registration, vehicles and verification." },
  { id: "delivery-partner", label: "Delivery Partner", app: "Feast Delivery", href: "/feast/delivery", detail: "Delivery registration and verification." },
] as const
export type PortalRole = typeof PORTAL_ROLES[number]
export type PortalRoleId = PortalRole["id"]

export const PARTNER_MENU = [
  { id: "shop-partner", label: "Selling Partner", detail: "Sell products on MStore" },
  { id: "feast-partner", label: "Food Partner", detail: "Manage your restaurant with Feast" },
  { id: "ride-partner", label: "Ride Partner", detail: "Drive with Mopedu" },
  { id: "delivery-partner", label: "Delivery Partner", detail: "Deliver orders with Feast" },
  { id: "doorstep-partner", label: "Home Services Professional", detail: "Offer your skills with Doorstep" },
] as const satisfies readonly { id: PortalRoleId; label: string; detail: string }[]
export function partnerForDestination(path: string) {
  const role = roleForPath(path)
  return PARTNER_MENU.find(item => item.id === role.id)
}

export function portalRole(id: string | null | undefined): PortalRole | undefined {
  return PORTAL_ROLES.find(role => role.id === id)
}
function within(path: string, root: string) { return path === root || path.startsWith(root + "/") }
export function roleForPath(path: string): PortalRole {
  const pathname = path.split(/[?#]/)[0]
  // Longest paths first: /shop/sell is not a shopper portal.
  return [...PORTAL_ROLES].sort((a, b) => b.href.length - a.href.length)
    .find(role => role.href !== "/" && within(pathname, role.href)) ?? PORTAL_ROLES[0]
}
export function roleChooserHref(path: string, target?: PortalRoleId): string {
  return portalLogoutHref(target ?? roleForPath(path).id)
}
export function portalLoginHref(id: PortalRoleId): string {
  const role = portalRole(id)!
  if (role.id.endsWith("-partner")) return "/partners/login?" + new URLSearchParams({ businesses: role.id, redirect: role.href })
  return "/login?" + new URLSearchParams({ redirect: role.href })
}
export function portalLogoutHref(id: PortalRoleId): string {
  // This path receives the legacy pm_rt cookie, which /api/auth cannot read.
  return "/api/postmatch/auth/logout?" + new URLSearchParams({ portal: id })
}
/** No free-form logout redirect: only shipped customer/partner destinations. */
export function logoutRedirect(portal: string | null): string {
  const role = portalRole(portal)
  return role ? portalLoginHref(role.id) : "/login"
}
/** Used only at portal entry/exit links, not links within the same workspace. */
export function portalEntryHref(path: string, href: string, signedIn: boolean, partnerPortal = false): string {
  const destinationRole = roleForPath(href)
  if (partnerPortal && !href.startsWith("/login?") && !href.startsWith("/partners/login?")) {
    if (href === "/partners" || href.startsWith("/partners?")) return href
    if (destinationRole.id.endsWith("-partner")) return signedIn ? href : portalLoginHref(destinationRole.id)
    if (signedIn) return portalLogoutHref(destinationRole.id)
  }
  if (href.startsWith("/login?")) {
    const redirect = new URLSearchParams(href.slice(href.indexOf("?") + 1)).get("redirect")
    const loginRole = PORTAL_ROLES.find(role => role.href === redirect && role.id.endsWith("-partner"))
    if (loginRole && signedIn) return roleChooserHref(path, loginRole.id)
    if (loginRole) return portalLoginHref(loginRole.id)
    return href
  }
  const destination = roleForPath(href)
  const current = roleForPath(path)
  const differentWorkspace = current.id !== destination.id
  const involvesPartner = current.id.endsWith("-partner") || destination.id.endsWith("-partner")
  if (signedIn && differentWorkspace && involvesPartner) return roleChooserHref(path, destination.id)
  if (!signedIn && destination.id.endsWith("-partner")) return portalLoginHref(destination.id)
  return href
}
