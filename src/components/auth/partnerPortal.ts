import { PARTNER_MENU, portalRole } from "./portalRoles"
import { authRedirect } from "./authRedirect"

export const PARTNER_ORIGIN = "https://partner.cleestudio.com"
export const CUSTOMER_ORIGIN = "https://cleestudio.com"
export type BusinessPartnerId = typeof PARTNER_MENU[number]["id"]

/** These are onboarding choices, not roles, approval or an access claim. */
export function businessSelections(value: string | null | undefined): BusinessPartnerId[] {
  if (!value || value.length > 512) return []
  const requested = new Set(value.split(","))
  return PARTNER_MENU.filter(item => requested.has(item.id)).map(item => item.id)
}
export function businessSelectionError(ids: readonly BusinessPartnerId[]): string | undefined {
  return businessSelections(ids.join(",")).length ? undefined : "Choose at least one business partner type. You can select more than one."
}
export function partnerHubHref(ids: readonly BusinessPartnerId[]): string {
  const clean = businessSelections(ids.join(","))
  return "/partners" + (clean.length ? "?" + new URLSearchParams({ businesses: clean.join(",") }) : "")
}
export function isPartnerHost(hostname: string): boolean {
  return hostname.toLowerCase() === "partner.cleestudio.com"
}
export function isCustomerHost(hostname: string): boolean {
  return ["cleestudio.com", "www.cleestudio.com"].includes(hostname.toLowerCase())
}
/** Only a fixed, known hostname affects presentation. Forwarded hosts cannot choose a redirect origin. */
export function portalHostname(urlHostname: string, hostHeader: string | null): string {
  if (isPartnerHost(urlHostname) || isCustomerHost(urlHostname)) return urlHostname.toLowerCase()
  const host = (hostHeader ?? "").toLowerCase().split(":")[0]
  return isPartnerHost(host) || isCustomerHost(host) ? host : urlHostname.toLowerCase()
}
export function partnerReturnPath(value: string | null): string {
  const safe = authRedirect(value)
  const path = safe.split(/[?#]/)[0]
  if (path === "/partners") return partnerHubHref(businessSelections(new URL(safe, PARTNER_ORIGIN).searchParams.get("businesses")))
  const role = portalRole(PARTNER_MENU.find(item => {
    const root = portalRole(item.id)!.href
    return path === root || path.startsWith(root + "/")
  })?.id)
  return role ? safe : "/partners"
}
export function partnerAuthHref(mode: "login" | "register", ids: readonly BusinessPartnerId[] = [], returnTo?: string): string {
  const clean = businessSelections(ids.join(","))
  const params = new URLSearchParams()
  if (clean.length) params.set("businesses", clean.join(","))
  if (returnTo) params.set("redirect", partnerReturnPath(returnTo))
  return `/partners/${mode}` + (params.size ? "?" + params : "")
}
export function partnerEntryLogoutHref(ids: readonly BusinessPartnerId[], mode: "login" | "register" = "login"): string {
  const params = new URLSearchParams({ partner: "1" })
  const clean = businessSelections(ids.join(","))
  if (clean.length) params.set("businesses", clean.join(","))
  if (mode === "register") params.set("intent", "register")
  return "/api/postmatch/auth/logout?" + params
}
/** No arbitrary origins, and no tokens, identifiers or user data cross between portals. */
export function portalLogoutDestination(hostname: string, id: string | null, intent: string | null = null, partnerEntry = false, businesses: string | null = null): string {
  const role = portalRole(id)
  if (partnerEntry) {
    const mode = intent === "register" ? "register" : "login"
    const clean = businessSelections(businesses)
    return isCustomerHost(hostname) || isPartnerHost(hostname) ? `${PARTNER_ORIGIN}/${mode}` + (clean.length ? "?" + new URLSearchParams({ businesses: clean.join(",") }) : "") : partnerAuthHref(mode, clean)
  }
  if (role?.id.endsWith("-partner")) {
    const mode = intent === "register" ? "register" : "login"
    const business = PARTNER_MENU.find(item => item.id === role.id)!
    const params = new URLSearchParams({ businesses: business.id })
    return isCustomerHost(hostname) || isPartnerHost(hostname)
      ? `${PARTNER_ORIGIN}/${mode}?${params}`
      : partnerAuthHref(mode, [business.id])
  }
  if (isPartnerHost(hostname)) return role ? `${CUSTOMER_ORIGIN}/login` + (role.href !== "/" ? "?" + new URLSearchParams({ redirect: role.href }) : "") : `${PARTNER_ORIGIN}/login`
  return role ? "/login?" + new URLSearchParams({ redirect: role.href }) : "/login"
}
