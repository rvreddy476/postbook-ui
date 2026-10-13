"use client"

import { useEffect, useRef, useState } from "react"
import { loadGoogleMaps, selectedPlace, validPoint, tokenHex, type Circle, type GoogleMap, type GooglePlace, type MapPoint, type MapsLibrary, type PlacesLibrary, type SelectedPlace } from "./google"
import "./maps.css"

// Lazy opt-in: a private saved pin is not sent to Google until the user opens a map.
export function GoogleLocation({ point, points = [], onPin, onPlace, label = "Location map", radiusM, openRequest = 0, unrestrictedSearch = false, pinHint = "Click the map to move the pin. Confirm the door, flat and address below before saving.", intro = "Search an address or see its pin with Google Maps." }: {
  point?: MapPoint | null; points?: { point: MapPoint; label: string }[]
  onPin?: (p: MapPoint) => void; onPlace?: (p: SelectedPlace) => void; label?: string
  radiusM?: number; openRequest?: number; unrestrictedSearch?: boolean; pinHint?: string; intro?: string
}) {
  const [active, setActive] = useState(false)
  useEffect(() => { if (openRequest > 0) setActive(true) }, [openRequest])
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const mapHost = useRef<HTMLDivElement>(null)
  const searchHost = useRef<HTMLDivElement>(null)
  const map = useRef<GoogleMap | null>(null)
  const library = useRef<MapsLibrary | null>(null)
  const callbacks = useRef({ onPin, onPlace })
  callbacks.current = { onPin, onPlace }
  const circles = useRef<Circle[]>([])
  const fitted = useRef(false)
  const pointsKey = JSON.stringify([...(validPoint(point) ? [{ point, label: "Selected location" }] : []), ...points.filter((p) => validPoint(p.point))])
  useEffect(() => {
    if (!active) return
    let gone = false
    let selectionVersion = 0
    let search: HTMLElement | undefined
    let listener: { remove(): void } | undefined
    let observer: MutationObserver | undefined
    const init = async () => {
      try {
        const google = await loadGoogleMaps()
        const maps = { ...await google.maps.importLibrary("maps") as object, ...await google.maps.importLibrary("core") as object } as MapsLibrary
        if (gone || !mapHost.current) return
        library.current = maps
        map.current = new maps.Map(mapHost.current, { center: { lat: 20.5937, lng: 78.9629 }, zoom: 5, gestureHandling: "cooperative", streetViewControl: false, mapTypeControl: false, fullscreenControl: true })
        const theme = () => {
          const css = getComputedStyle(document.documentElement)
          const card = tokenHex(css.getPropertyValue("--brand-card"))
          const text = tokenHex(css.getPropertyValue("--brand-text"))
          map.current?.setOptions({ styles: document.documentElement.classList.contains("dark") ? [{ elementType: "geometry", stylers: [{ color: card }] }, { elementType: "labels.text.fill", stylers: [{ color: text }] }, { elementType: "labels.text.stroke", stylers: [{ color: card }] }] : [] })
        }
        theme()
        observer = new MutationObserver(theme)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
        listener = maps.event.addListener(map.current, "click", (e) => {
          const p = e.latLng && { lat: e.latLng.lat(), lng: e.latLng.lng() }
          if (validPoint(p)) callbacks.current.onPin?.(p)
        })
        setReady(true)
        if (callbacks.current.onPlace && searchHost.current) {
          const places = await google.maps.importLibrary("places") as PlacesLibrary
          if (gone || !searchHost.current) return
          search = new places.PlaceAutocompleteElement(unrestrictedSearch ? {} : { includedRegionCodes: ["in"] })
          search.setAttribute("aria-label", unrestrictedSearch ? "Search any town, area or address" : "Search for an address in India")
          if (unrestrictedSearch) search.setAttribute("placeholder", "Enter a town, area or address")
          searchHost.current.replaceChildren(search)
          if (openRequest > 0) search.focus()
          search.addEventListener("gmp-error", () => !gone && setError("Address search is unavailable. Select a pin on the map or try again later."))
          search.addEventListener("gmp-select", async (event) => {
            const version = ++selectionVersion
            try {
              const prediction = (event as Event & { placePrediction: { toPlace(): GooglePlace } }).placePrediction
              const place = prediction.toPlace()
              await place.fetchFields({ fields: ["location", "formattedAddress", "addressComponents"] })
              if (gone || version !== selectionVersion) return
              const selected = selectedPlace(place)
              if (selected) { setError(""); callbacks.current.onPlace?.(selected); map.current?.setCenter(selected) }
              else setError("This address has no usable map pin. Choose another result or pin it yourself.")
            } catch { if (!gone && version === selectionVersion) setError("That address could not be loaded. Try another result or select a pin on the map.") }
          })
        }
      } catch (e) { if (!gone) setError(e instanceof Error ? e.message : "Maps are unavailable. Enter the address manually.") }
    }
    void init()
    return () => { gone = true; observer?.disconnect(); listener?.remove(); search?.remove(); circles.current.forEach((c) => c.setMap(null)); circles.current = []; map.current = null; fitted.current = false }
  }, [active])
  useEffect(() => {
    if (!ready || !map.current || !library.current) return
    const current = JSON.parse(pointsKey) as { point: MapPoint; label: string }[]
    circles.current.forEach((c) => c.setMap(null))
    circles.current = current.map(({ point }, index) => new library.current!.Circle({ map: map.current, center: point, radius: 24, fillColor: tokenHex(getComputedStyle(document.documentElement).getPropertyValue(index % 2 ? "--brand-text" : "--brand-accent")), fillOpacity: 0.8, strokeWeight: 2, clickable: false }))
    if (validPoint(point) && radiusM && radiusM > 0) {
      const color = tokenHex(getComputedStyle(document.documentElement).getPropertyValue("--brand-accent"))
      circles.current.push(new library.current.Circle({ map: map.current, center: point, radius: radiusM, fillColor: color, fillOpacity: 0.12, strokeColor: color, strokeWeight: 2, clickable: false }))
    }
    if (current.length && (!fitted.current || onPin)) {
      if (current.length === 1) { map.current.setCenter(current[0].point); map.current.setOptions({ zoom: radiusM ? Math.max(9, 14 - Math.log2(radiusM / 1000)) : 16 }) }
      else { const bounds = new library.current.LatLngBounds(); current.forEach(({ point }) => bounds.extend(point)); map.current.fitBounds(bounds) }
      fitted.current = true
    }
  }, [ready, pointsKey, onPin, radiusM, point])
  return <section className="google-location" aria-label={label}>
    {!active ? <div className="google-location__intro"><p>{intro}</p><p className="google-location__note">Opening maps shares the displayed locations and your search with Google.</p><button type="button" onClick={() => setActive(true)}>Open Google Maps</button></div> : <>
      {onPlace ? <div ref={searchHost} className="google-location__search" /> : null}
      <div ref={mapHost} className="google-location__map" role="region" aria-label={label} />
      {!ready && !error ? <p role="status">Loading Google Maps…</p> : null}
      {onPin && ready ? <p className="google-location__note">{pinHint}</p> : null}
      {error ? <p role="alert" className="google-location__note">{error}</p> : null}
      {points.length ? <ul className="google-location__legend">{points.filter((p) => validPoint(p.point)).map((p) => <li key={p.label}>{p.label}</li>)}</ul> : null}
    </>}
  </section>
}
