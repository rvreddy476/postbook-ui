"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, LocateFixed, MapPin, RefreshCw } from "lucide-react"
import { useCurrentLocation } from "@/features/maps/CurrentLocation"
import { useCurrentServiceArea } from "./NearbyServices"
import "./header-location.css"

export function DoorstepHeaderLocation() {
  const location = useCurrentLocation()
  const area = useCurrentServiceArea()
  const busy = location.status === "locating" || Boolean(location.refreshing) || area.isFetching
  const name = area.data?.zone?.name ?? area.data?.city?.name ?? (busy ? "Finding your area…" : location.status !== "ready" ? "Enable location" : area.isError ? "Location unavailable" : "Current location")
  const detail = location.message || (area.isError ? "We couldn’t check your area. Refresh to try again." : area.data && !area.data.serviceable ? "Home services aren’t available in this area yet." : "Nearby services use your device location.")
  return <HeaderLocationControl name={name} city={area.data?.city?.name} busy={busy} detail={detail} onRefresh={location.refresh} />
}

export function HeaderLocationControl({ name, city, busy, detail, onRefresh }: { name: string; city?: string; busy: boolean; detail: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus() } }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape) }
  }, [open])
  return <div className="ds-header-location" ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false) }}>
    <button ref={trigger} type="button" className="ds-header-location__trigger" aria-label={`Location: ${name}. Show details`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(v => !v)}>
      <span className="ds-header-location__pin"><MapPin size={19} aria-hidden /></span>
      <span className="ds-header-location__text"><span className="ds-header-location__eyebrow">Your location</span><strong title={name}>{name}</strong></span>
      <ChevronDown className={open ? "ds-header-location__chevron is-open" : "ds-header-location__chevron"} size={16} aria-hidden />
    </button>
    <button type="button" className="ds-header-location__refresh" disabled={busy} onClick={onRefresh} aria-label="Refresh current location" title="Refresh current location"><RefreshCw size={17} className={busy ? "is-spinning" : undefined} aria-hidden /></button>
    <span className="sr-only" role="status">{busy ? "Refreshing location" : `Location: ${name}`}</span>
    {open && <section className="ds-header-location__panel" id={panelId} aria-label="Current location details">
      <span className="ds-header-location__eyebrow">Current area</span><h2>{name}</h2>{city && city !== name && <p className="ds-header-location__city">{city}</p>}
      <p>{detail}</p>
      <button type="button" disabled={busy} onClick={onRefresh}><LocateFixed size={17} aria-hidden />{busy ? "Updating location…" : "Use current location"}</button>
    </section>}
  </div>
}
