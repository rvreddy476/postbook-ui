import { portalRole, portalLogoutHref } from "./portalRoles"

export interface PortalSwitchEffects {
  signedIn: boolean
  cancelQueries(): void
  clearQueries(): void
  prepareLogout(): void
  navigate(href: string): void
}
/** Local state is forgotten before navigation; the server response clears cookies before redirecting. */
export function beginPortalSwitch(id: string | null, effects: PortalSwitchEffects): boolean {
  const role = portalRole(id)
  if (!role) return false
  // A missing local user record does not prove the HttpOnly cookies are gone.
  // Always pass through both server logout responses, even on the login page.
  effects.cancelQueries()
  effects.clearQueries()
  effects.prepareLogout()
  effects.navigate(portalLogoutHref(role.id))
  return true
}
