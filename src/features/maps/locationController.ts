import { validPoint, type MapPoint } from "./google"

export const LOCATION_MAX_AGE_MS = 5 * 60_000
export const LOCATION_REUSE_MAX_AGE_MS = 30 * 60_000
export type LocationState = { status: "idle" | "locating" | "ready" | "error"; point: MapPoint | null; accuracy: number | null; capturedAt: number; message: string; refreshing?: boolean }
export const EMPTY_LOCATION: LocationState = { status: "idle", point: null, accuracy: null, capturedAt: 0, message: "" }
export type LocationSource = Pick<Geolocation, "getCurrentPosition">
export function locationMessage(code: number): string {
  if (code === 1) return "Location access is required. Allow location for this site in your browser settings, then try again."
  if (code === 3) return "Finding your location took too long. Turn on device location and try again."
  return "Your location is unavailable. Turn on device location and check your connection, then try again."
}
export function locationFresh(state: LocationState, now = Date.now()): boolean {
  return state.status === "ready" && validPoint(state.point) && now >= state.capturedAt && now - state.capturedAt < LOCATION_MAX_AGE_MS
}

/** A bounded, in-memory fix can keep the journey visible during a quiet refresh. */
export function locationUsable(state: LocationState, now = Date.now()): boolean {
  return state.status === "ready" && validPoint(state.point) && now >= state.capturedAt && now - state.capturedAt < LOCATION_REUSE_MAX_AGE_MS
}

/** One foreground location fix, not background tracking. No persistent storage. */
export function createLocationController(now = Date.now) {
  let state = EMPTY_LOCATION
  let version = 0
  const listeners = new Set<() => void>()
  const set = (next: LocationState) => { state = next; listeners.forEach(fn => fn()) }
  const reset = (message = "") => { version++; set({ ...EMPTY_LOCATION, status: message ? "error" : "idle", message }) }
  const controller = {
    snapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    reset,
    ensure: (source?: LocationSource, secure = true) => {
      if (!locationFresh(state, now())) controller.request(source, secure)
    },
    request: (source?: LocationSource, secure = true) => {
      if (state.status === "locating" || state.refreshing) return
      if (!secure) { reset("Location requires a secure connection. Open this app over HTTPS."); return }
      if (!source) { reset("This browser cannot provide location. Use a supported browser with device location enabled."); return }
      const requestVersion = ++version
      const previous = state
      const fail = (message: string, revoke = false) => {
        if (requestVersion !== version) return
        if (!revoke && locationUsable(previous, now())) set({ ...previous, refreshing: false, message })
        else reset(message)
      }
      set(locationUsable(previous, now()) ? { ...previous, refreshing: true, message: "" } : { ...EMPTY_LOCATION, status: "locating" })
      try { source.getCurrentPosition(position => {
        if (requestVersion !== version) return
        const point = { lat: position.coords.latitude, lng: position.coords.longitude }
        const accuracy = position.coords.accuracy
        if (!validPoint(point) || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 500 || now() - position.timestamp > 60_000 || position.timestamp > now() + 10_000) {
          fail("Your location is too approximate or out of date. Turn on precise location and try again."); return
        }
        set({ status: "ready", point, accuracy, capturedAt: now(), message: "" })
      }, error => {
        fail(locationMessage(error.code), error.code === 1)
      }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }) } catch { fail("Your browser blocked location. Allow location access in site settings, then try again.", true) }
    },
  }
  return controller
}

export function locationRequired(path: string, app: "doorstep" | "feast"): boolean {
  if (app === "doorstep") return path === "/doorstep" || path.startsWith("/doorstep/c/") || path.startsWith("/doorstep/s/") || path === "/doorstep/checkout"
  return path === "/feast" || path.startsWith("/feast/r/") || path === "/feast/cart" || path === "/feast/checkout"
}
