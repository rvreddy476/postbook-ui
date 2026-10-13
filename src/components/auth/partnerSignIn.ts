import { partnerReturnPath } from "./partnerPortal"

export async function requestPartnerPhone(path: "request" | "verify", body: unknown) {
  let response: Response
  try {
    response = await fetch(`/api/auth/partner/phone/${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new Error("We couldn’t reach sign-in. Check your connection and try again.")
  }
  let payload
  try { payload = await response.json() } catch {
    throw new Error("Sign-in returned an unexpected response. Please try again.")
  }
  if (!response.ok) throw new Error(payload.error?.message ?? "We couldn’t complete verification. Please try again.")
  if (!payload?.data || typeof payload.data !== "object") throw new Error("Sign-in did not finish. Please try again.")
  return payload
}

/** Start a fresh document after the BFF has set the session cookies.
 * A client-router transition can reuse a signed-out, prefetched redirect.
 * Do not submit the single-use OTP again just to retry navigation.
 */
export function openPartnerWorkspace(destination: string, navigation: Pick<Location, "replace"> = window.location) {
  navigation.replace(partnerReturnPath(destination))
}
