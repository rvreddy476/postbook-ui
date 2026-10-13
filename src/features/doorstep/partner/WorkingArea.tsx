"use client"

import { Info, LocateFixed, MapPin, Radar, Search } from "lucide-react"
import { useRef, useState } from "react"
import { reverseAreaName } from "@/features/maps/reverseGeocode"
import { GoogleLocation } from "@/features/maps/GoogleLocation"
import { type MapPoint } from "@/features/maps/google"
import { partnerApi } from "./api"
import { Field, ReadPanel, SaveForm, usePartnerRead } from "./ui"
import { areaError } from "./workingAreaRules"

export function WorkingArea() {
  const query = usePartnerRead("area-editor", async () => {
    const [zones, saved, changes] = await Promise.all([partnerApi.zones(), partnerApi.area(), partnerApi.changes()])
    const pending = changes.find(c => c.kind === "area" && c.status === "pending")
    const proposed = pending?.payload.area as typeof saved | undefined
    return { zones, area: proposed ?? saved, pending: Boolean(pending) }
  })
  return <ReadPanel query={query}>{data => <div className="ds-stack"><div className="ds-row"><button type="button" className="ds-btn ds-btn--outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Refreshing zones…" : "Refresh available zones"}</button></div><WorkingAreaForm data={data} /></div>}</ReadPanel>
}

export function WorkingAreaForm({ data }: { data: { zones: Awaited<ReturnType<typeof partnerApi.zones>>; area: Awaited<ReturnType<typeof partnerApi.area>>; pending?: boolean } }) {
  const [manualSearch, setManualSearch] = useState(0)
  const [zones, setZones] = useState(data.area.zone_ids.filter(id => data.zones.some(z => z.id === id)))
  const [point, setPoint] = useState<MapPoint | null>(data.area.home_lat != null && data.area.home_lng != null ? { lat: data.area.home_lat, lng: data.area.home_lng } : null)
  const [radius, setRadius] = useState(data.area.radius_m || 5000)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState("")
  const [locationName, setLocationName] = useState(data.area.area_label ?? "")
  const [labelEditable, setLabelEditable] = useState(!data.area.area_label)
  const selection = useRef(0)
  async function choosePoint(p: MapPoint, name?: string) {
    const version = ++selection.current
    setPoint(p); setLabelEditable(false); setLocationName(name ?? ""); setLocationError(""); setLocating(!name)
    if (name) return
    try { const area = await reverseAreaName(p); if (selection.current === version) setLocationName(area) }
    catch (e) { if (selection.current === version) { setLabelEditable(true); setLocationError(e instanceof Error ? e.message : "Enter the area name for this location.") } }
    finally { if (selection.current === version) setLocating(false) }
  }
  function locate() {
    if (!navigator.geolocation) { setLocationError("Location access isn’t available. Open the map to search or select your starting point."); return }
    const version = ++selection.current
    setLocating(true); setLocationError("")
    navigator.geolocation.getCurrentPosition(p => {
      if (version === selection.current) void choosePoint({ lat: p.coords.latitude, lng: p.coords.longitude })
    }, e => {
      if (version !== selection.current) return
      setLocating(false)
      setLocationError(e.code === 1 ? "Location permission is off. Allow it in your browser settings, or choose a location on the map." : "We couldn’t find your location. Try again or select it on the map.")
    }, { timeout: 15000, maximumAge: 0, enableHighAccuracy: true })
  }
  return <SaveForm disabled={locating || data.pending} save={() => {
    const error = areaError(point, radius, zones, data.zones.map(z => z.id))
    if (error) throw new Error(error)
    if (!locationName.trim()) throw new Error("Enter the area name for your selected location.")
    return partnerApi.saveArea({ zone_ids: zones, home_lat: point!.lat, home_lng: point!.lng, radius_m: radius, area_label: locationName.trim() })
  }}>
    <p className="ds-sub">Choose where you work and how far you’re happy to travel.</p>
    {data.pending && <p className="ds-info" role="status">This working area is awaiting admin approval. Your approved working area remains active.</p>}
    {!data.zones.length && <div className="ds-area-notice" role="status"><Info size={22} aria-hidden="true" /><div><strong>Bookings aren’t available in your area yet</strong><p>You can save your location and travel distance now. Select a working zone when coverage opens.</p></div></div>}
    <div className="ds-area-layout">
      <div className="ds-area-settings">
        <section className="ds-area-location"><span className="ds-partner-mark"><MapPin size={24} /></span><div><h3>Your location</h3><Field label="Working area *" hint={labelEditable ? "Name the selected location. Use search to choose a different place." : undefined}><input className="ds-input" readOnly={!labelEditable} required maxLength={500} value={locationName} placeholder={locating ? "Finding your area…" : "Select a location or enter its area name"} onChange={e => setLocationName(e.target.value)} /></Field><button type="button" className="ds-btn ds-btn--outline" disabled={locating} onClick={locate}><LocateFixed size={18} />{locating ? "Finding location…" : "Use current location"}</button><button type="button" className="ds-btn ds-btn--outline" onClick={() => setManualSearch(n => n + 1)}><Search size={18}/>Search area manually</button><small>Search any town, area or address without sharing your device location. Location lookup uses Google Maps.</small></div></section>
        {locationError && <p className="ds-alert" role="alert">{locationError}</p>}
        <section className="ds-area-radius"><div className="ds-area-radius-heading"><span className="ds-partner-mark"><Radar size={24} /></span><div><label htmlFor="partner-travel-radius">Travel radius</label><p>Distance from your starting point.</p></div><output htmlFor="partner-travel-radius">{radius / 1000} km</output></div><input id="partner-travel-radius" type="range" min={1000} max={15000} step={1000} value={radius} aria-valuetext={`${radius / 1000} kilometres`} onChange={e => setRadius(Number(e.target.value))} /><div className="ds-area-ticks" aria-hidden="true"><span>1 km</span><span>5 km</span><span>10 km</span><span>15 km</span></div></section>
      </div>
      <div className="ds-area-map"><GoogleLocation openRequest={manualSearch} unrestrictedSearch point={point} radiusM={radius} onPin={p => void choosePoint(p)} onPlace={p => void choosePoint(p, p.address || undefined)} label="Your working area" pinHint="Select your starting point on the map. The circle shows your travel distance, not service availability." intro="Preview your travel radius or search for your starting point." /></div>
    </div>
    {data.zones.length > 0 && <section className="ds-stack"><h3 className="ds-h2">Available working zones</h3><p className="ds-sub">These zones are enabled by Admin. Select where you work; jobs must also be within your travel radius. Changes require review.</p><div className="ds-partner-choices">{data.zones.map(z => <label className={`ds-choice ${zones.includes(z.id) ? "is-on" : ""}`} key={z.id}><input type="checkbox" checked={zones.includes(z.id)} onChange={e => setZones(e.target.checked ? [...zones, z.id] : zones.filter(id => id !== z.id))} /><span><strong>{z.name}</strong><small className="ds-partner-choice-note">{zones.includes(z.id) ? "Selected working zone" : "Available in your city"}</small></span></label>)}</div></section>}
  </SaveForm>
}
