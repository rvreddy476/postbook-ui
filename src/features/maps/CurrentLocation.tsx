"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react"
import { LocateFixed, MapPin, RefreshCw } from "lucide-react"
import { useAuthUser } from "@/store/auth"
import { createLocationController, EMPTY_LOCATION, locationFresh, locationUsable, locationMessage, type LocationState } from "./locationController"
import "./maps.css"

type LocationContext = LocationState & { refresh: () => void; retain: () => () => void }
const Context = createContext<LocationContext | null>(null)
const emptyContext: LocationContext = { ...EMPTY_LOCATION, refresh: () => {}, retain: () => () => {} }
export const useCurrentLocation = () => useContext(Context) ?? emptyContext

/** Above route pages: coordinates live in memory, never persistent storage. */
export function CurrentLocationProvider({ children }: { children: ReactNode }) {
  const user = useAuthUser()
  return <LocationSession key={user?.id ?? "signed-out"} enabled={Boolean(user)}>{children}</LocationSession>
}

export function CurrentLocationBoundary({ children, gate = true }: { children: ReactNode; gate?: boolean }) {
  const parent = useContext(Context)
  return parent ? <LocationConsumer gate={gate}>{children}</LocationConsumer> : <CurrentLocationProvider><LocationConsumer gate={gate}>{children}</LocationConsumer></CurrentLocationProvider>
}

function LocationConsumer({ children, gate }: { children: ReactNode; gate: boolean }) {
  const { retain } = useCurrentLocation()
  useEffect(retain, [retain])
  return gate ? <CurrentLocationGate>{children}</CurrentLocationGate> : children
}

function LocationSession({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const controller = useMemo(() => createLocationController(), [])
  const consumers = useRef(0)
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, () => EMPTY_LOCATION)
  const refresh = useCallback(() => {
    if (enabled) controller.request(navigator.geolocation, window.isSecureContext)
  }, [controller, enabled])
  const retain = useCallback(() => {
    consumers.current++
    if (enabled) controller.ensure(navigator.geolocation, window.isSecureContext)
    return () => { consumers.current = Math.max(0, consumers.current - 1) }
  }, [controller, enabled])
  useEffect(() => {
    if (!enabled) return
    let gone = false
    let permission: PermissionStatus | undefined
    const changed = () => {
      if (permission?.state !== "granted") controller.reset(permission?.state === "denied" ? locationMessage(1) : "Location permission was changed. Allow location to continue.")
      else if (consumers.current > 0) refresh()
    }
    void navigator.permissions?.query({ name: "geolocation" }).then(value => {
      if (gone) return
      permission = value
      permission.addEventListener("change", changed)
      if (permission.state === "denied") changed()
    }).catch(() => {})
    const foreground = () => {
      if (consumers.current > 0 && document.visibilityState === "visible" && !locationFresh(controller.snapshot()) && controller.snapshot().status === "ready") refresh()
    }
    document.addEventListener("visibilitychange", foreground)
    window.addEventListener("focus", foreground)
    const expiry = window.setInterval(foreground, 30_000)
    return () => { gone = true; controller.reset(); permission?.removeEventListener("change", changed); document.removeEventListener("visibilitychange", foreground); window.removeEventListener("focus", foreground); clearInterval(expiry) }
  }, [controller, enabled, refresh])
  const value = useMemo(() => ({ ...state, refresh, retain }), [state, refresh, retain])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** Gate only the service content, keeping header navigation available. */
export function CurrentLocationGate({ children }: { children: ReactNode }) {
  const state = useCurrentLocation()
  const { refresh } = state
  const enabled = Boolean(useAuthUser())
  return locationUsable(state) ? children : <section className="current-location current-location--gate" aria-labelledby="current-location-title">
    <span className="current-location__icon"><LocateFixed size={26} aria-hidden /></span>
    <h1 id="current-location-title">Find services near you</h1>
    <p>Allow location to see what’s available in your area.</p>
    <p className="current-location__note">Your location stays with you while you browse. No background tracking.</p>
    {state.status === "locating" ? <p role="status">Finding your current location…</p> : <><p role={state.message ? "alert" : "status"}>{state.message || (enabled ? "Location access is required to continue." : "Sign in to continue to nearby services.")}</p><button type="button" disabled={!enabled} onClick={refresh}><LocateFixed size={16} aria-hidden />{state.status === "error" ? "Try location again" : "Allow location"}</button></>}
  </section>
}

export function CurrentLocationBar({ label = "Using your current location" }: { label?: string }) {
  const location = useCurrentLocation()
  return <div className="current-location current-location--bar"><MapPin size={18} aria-hidden /><div><strong>{label}</strong><span>No saved address required to explore nearby.</span></div><button type="button" onClick={location.refresh} aria-label="Refresh current location"><RefreshCw size={15} aria-hidden />Refresh</button></div>
}
