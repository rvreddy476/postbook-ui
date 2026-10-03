"use client"

/*
  Location: browser geolocation ONLY after a rationale the partner reads and
  accepts (the permission prompt is never the first thing they see), or the
  coordinates typed by hand. No map key exists, so a calm placeholder stands
  where a map would be, with a plain Google Maps search link to check the pin.
*/

import { LocateFixed, MapPin } from "lucide-react"
import { useEffect, useState } from "react"

import { fetchLocation, putLocation } from "../../api/client"
import { toFailure, type ApiFailure } from "../../model/errors"
import { LOCATION_STATE_NAMES } from "../../model/kyc"
import { FailureNotice, Field, Notice, useAction } from "../ui"

const MIN_KM = 1
const MAX_KM = 15

type GeoState = { kind: "idle" } | { kind: "rationale" } | { kind: "locating" } | { kind: "denied"; message: string }

export function LocationPanel({ restaurantId, onSaved }: { restaurantId: string; onSaved: () => void }) {
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [line1, setLine1] = useState("")
  const [line2, setLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postal, setPostal] = useState("")
  const [radius, setRadius] = useState("5")
  const [geo, setGeo] = useState<GeoState>({ kind: "idle" })
  const [loadFailure, setLoadFailure] = useState<ApiFailure | null>(null)
  const [local, setLocal] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const action = useAction()

  useEffect(() => {
    let live = true
    fetchLocation(restaurantId)
      .then((l) => {
        if (!live) return
        setLat(String(l.latitude))
        setLng(String(l.longitude))
        setLine1(l.addressLine1)
        setLine2(l.addressLine2 ?? "")
        setCity(l.city)
        setState(l.state)
        setPostal(l.postalCode ?? "")
        setRadius(String(l.deliveryRadiusKm))
      })
      .catch((e) => {
        const f = toFailure(e)
        // Not saved yet is the normal first visit.
        if (live && f.code !== "FOOD_ONBOARDING_STEP_NOT_SAVED") setLoadFailure(f)
      })
    return () => {
      live = false
    }
  }, [restaurantId])

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeo({ kind: "denied", message: "This browser can't share a location. Type the coordinates instead." })
      return
    }
    setGeo({ kind: "locating" })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6))
        setLng(pos.coords.longitude.toFixed(6))
        setGeo({ kind: "idle" })
      },
      (err) =>
        setGeo({
          kind: "denied",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location access was refused. You can allow it in the browser's site settings, or type the coordinates below."
              : "We couldn't get a location fix. Type the coordinates below.",
        }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  const latN = Number(lat)
  const lngN = Number(lng)
  const radiusN = Number(radius)
  const coordsOk = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180 && !(latN === 0 && lngN === 0)
  const radiusOk = Number.isFinite(radiusN) && radiusN >= MIN_KM && radiusN <= MAX_KM

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    if (!coordsOk) return setLocal("Enter a latitude (−90 to 90) and longitude (−180 to 180), or use this device's location.")
    if (!line1.trim() || !city.trim()) return setLocal("Enter the address and city.")
    if (!state) return setLocal("Choose the state.")
    if (!radiusOk) return setLocal(`Delivery radius is ${MIN_KM} to ${MAX_KM} km.`)
    setLocal(null)
    const ok = await action.run(() =>
      putLocation(restaurantId, {
        latitude: latN,
        longitude: lngN,
        address_line1: line1.trim(),
        address_line2: line2.trim(),
        city: city.trim(),
        state,
        postal_code: postal.trim(),
        delivery_radius_km: radiusN,
      }),
    )
    if (ok) {
      setSaved(true)
      onSaved()
    }
  }

  const mapsLink = coordsOk ? `https://www.google.com/maps/search/?api=1&query=${latN},${lngN}` : null

  return (
    <form className="kit-form kit-form--2" onSubmit={save} noValidate>
      <FailureNotice failure={loadFailure} />
      <div className="kit-span">
        <div className="kit-map" aria-label="Map placeholder">
          <MapPin size={18} aria-hidden />
          {coordsOk ? (
            <>
              <span>
                Pin at {latN.toFixed(5)}, {lngN.toFixed(5)} · delivers {radiusOk ? `${radiusN} km` : "—"} around
              </span>
              {mapsLink ? (
                <a className="kit-btn kit-btn--ghost kit-btn--sm" href={mapsLink} target="_blank" rel="noopener noreferrer">
                  Check the pin on Google Maps
                </a>
              ) : null}
            </>
          ) : (
            <span>No pin yet. Use this device&apos;s location while you&apos;re at the kitchen, or type the coordinates.</span>
          )}
        </div>
      </div>

      <div className="kit-span">
        {geo.kind === "rationale" ? (
          <Notice>
            <p style={{ margin: "0 0 8px" }}>
              Feast uses your kitchen&apos;s exact position to show you to customers nearby and to send riders to the right door. Your browser will ask
              to share this device&apos;s location once; do this while you are at the kitchen. It is used only to fill the pin below.
            </p>
            <div className="kit-row">
              <button type="button" className="kit-btn kit-btn--primary kit-btn--sm" onClick={locate}>
                Continue
              </button>
              <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={() => setGeo({ kind: "idle" })}>
                Not now
              </button>
            </div>
          </Notice>
        ) : (
          <button type="button" className="kit-btn kit-btn--outline kit-btn--sm" onClick={() => setGeo({ kind: "rationale" })} disabled={geo.kind === "locating"}>
            <LocateFixed size={14} aria-hidden />
            {geo.kind === "locating" ? "Finding the kitchen…" : "Use this device's location"}
          </button>
        )}
        {geo.kind === "denied" ? <p className="kit-error">{geo.message}</p> : null}
      </div>

      <Field label="Latitude">
        <input className="kit-input" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="12.9716" />
      </Field>
      <Field label="Longitude">
        <input className="kit-input" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="77.5946" />
      </Field>
      <Field label="Address" span>
        <input className="kit-input" value={line1} onChange={(e) => setLine1(e.target.value)} maxLength={255} autoComplete="address-line1" />
      </Field>
      <Field label="Landmark or floor (optional)" span>
        <input className="kit-input" value={line2} onChange={(e) => setLine2(e.target.value)} maxLength={255} autoComplete="address-line2" />
      </Field>
      <Field label="City">
        <input className="kit-input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} autoComplete="address-level2" />
      </Field>
      <Field label="State" hint="Used for GST on every order.">
        <select className="kit-select" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Choose…</option>
          {LOCATION_STATE_NAMES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="PIN code">
        <input className="kit-input" inputMode="numeric" value={postal} onChange={(e) => setPostal(e.target.value)} maxLength={20} autoComplete="postal-code" />
      </Field>
      <Field label={`Delivery radius (km, ${MIN_KM}–${MAX_KM})`} error={radiusOk ? null : `${MIN_KM} to ${MAX_KM} km.`}>
        <input className="kit-input" type="number" min={MIN_KM} max={MAX_KM} step={0.5} value={radius} onChange={(e) => setRadius(e.target.value)} />
      </Field>

      <div className="kit-span kit-form">
        {local ? <Notice tone="danger">{local}</Notice> : null}
        <FailureNotice failure={action.failure} />
        {saved ? <Notice tone="success">Location saved.</Notice> : null}
        <div className="kit-row kit-row--end">
          <button type="submit" className="kit-btn kit-btn--primary" disabled={action.busy}>
            {action.busy ? "Saving…" : "Save location"}
          </button>
        </div>
      </div>
    </form>
  )
}
