import { prepareLogoutNavigation } from "@/services/authService"
import { clearPostMatchAuth } from "@/lib/postmatchApi"
import { clearAccessToken } from "@/lib/accessToken"

/** Forget account state, not theme preferences or offline downloads. */
export function clearPortalSession() {
  clearAccessToken()
  try { prepareLogoutNavigation() } catch { /* Navigation still ends the server session when browser storage is blocked. */ }
  try { clearPostMatchAuth() } catch { /* Memory token is cleared before the storage operation. */ }
  try { localStorage.removeItem("feast.kitchen.restaurant"); sessionStorage.clear() } catch { /* Storage may be blocked. */ }
}
