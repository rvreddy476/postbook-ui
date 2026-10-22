/*
  Shared location in chat (founder, 23 Oct 2026: WhatsApp's "Send your
  current location"). Pure helpers: the wire shape, the static map preview,
  the Maps link and the geolocation error copy. The network call is
  sendLocationMessage in services/chatParityApi.ts; the UI is
  components/messenger/thread/LocationSheet.tsx and LocationBubble.tsx.

  Privacy: coordinates never go into a log, a URL of ours or a preview. The
  only URLs that carry them are the map image the sender's / reader's own
  browser loads and the "Open in Maps" link the reader chooses to follow.
*/

// Self-contained readers: contract.ts imports decodeLocation from here.
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

export interface ChatLocation {
  lat: number
  lng: number
  accuracyM: number | null
  label: string | null
  address: string | null
}

/** Label and address cap (message-service LocationPlaceMaxRunes). */
export const LOCATION_PLACE_MAX = 200

/** 5 decimals (~1 m), as the server stores it. */
export function roundCoord(v: number): number {
  const r = Math.round(v * 1e5) / 1e5
  return r === 0 ? 0 : r // no "-0"
}

export function validCoords(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

/** Trim and cap a label/address at LOCATION_PLACE_MAX characters (code points). */
export function capPlaceText(s: string | null | undefined): string {
  // eslint-disable-next-line no-control-regex
  const flat = (s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
  const chars = Array.from(flat)
  return chars.length > LOCATION_PLACE_MAX ? chars.slice(0, LOCATION_PLACE_MAX).join('').trim() : flat
}

/** The location message body for POST …/messages. */
export function locationMessageBody(loc: ChatLocation): Record<string, unknown> {
  const location: Record<string, unknown> = { lat: roundCoord(loc.lat), lng: roundCoord(loc.lng) }
  if (loc.accuracyM !== null && Number.isFinite(loc.accuracyM) && loc.accuracyM >= 0) {
    location.accuracy_m = Math.min(100_000, Math.round(loc.accuracyM))
  }
  const label = capPlaceText(loc.label)
  const address = capPlaceText(loc.address)
  if (label) location.label = label
  if (address) location.address = address
  return { type: 'location', location }
}

/** The `location` object on a message, or null when absent or malformed. */
export function decodeLocation(raw: unknown): ChatLocation | null {
  if (!isObj(raw)) return null
  const lat = numOrNull(raw.lat)
  const lng = numOrNull(raw.lng)
  if (!validCoords(lat, lng)) return null
  return {
    lat: lat as number,
    lng: lng as number,
    accuracyM: numOrNull(raw.accuracy_m),
    label: str(raw.label),
    address: str(raw.address),
  }
}

/** "Open in Maps": Google's universal search link (opens the app on phones). */
export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${roundCoord(lat)},${roundCoord(lng)}`
}

/* ---- Static map preview ------------------------------------------ */

export const MAP_ZOOM = 15
const TILE = 256

/**
 * The OpenStreetMap tile that contains the point, and where in it the point
 * falls (0..256 px), for a keyless preview. Standard Web Mercator slippy-map
 * maths (https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames).
 */
export function osmTile(lat: number, lng: number, zoom = MAP_ZOOM): { url: string; x: number; y: number; offsetX: number; offsetY: number } {
  const n = 2 ** zoom
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat))
  const rad = (clampedLat * Math.PI) / 180
  const fx = ((lng + 180) / 360) * n
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  const x = Math.min(n - 1, Math.max(0, Math.floor(fx)))
  const y = Math.min(n - 1, Math.max(0, Math.floor(fy)))
  return {
    url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
    x,
    y,
    offsetX: Math.round((fx - x) * TILE),
    offsetY: Math.round((fy - y) * TILE),
  }
}

/** The browser Maps key, when this build has one (features/maps/google.ts). */
export function mapsBrowserKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  return key ? key : null
}

/**
 * Google Static Maps with the browser key, centred on the point with a pin.
 * `key` comes from mapsBrowserKey(); null means "use the OSM tile".
 */
export function googleStaticMapUrl(lat: number, lng: number, key: string | null, size = { w: 280, h: 160 }): string | null {
  if (!key) return null
  const at = `${roundCoord(lat)},${roundCoord(lng)}`
  const q = new URLSearchParams({
    center: at,
    zoom: String(MAP_ZOOM),
    size: `${size.w}x${size.h}`,
    scale: '2',
    markers: at,
    key,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${q}`
}

/* ---- Geolocation --------------------------------------------------- */

export type GeoProblem = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout'

/** GeolocationPositionError.code → our problem. */
export function geoProblemOf(code: number | undefined): GeoProblem {
  if (code === 1) return 'denied'
  if (code === 3) return 'timeout'
  return 'unavailable'
}

export function geoProblemText(p: GeoProblem): string {
  switch (p) {
    case 'unsupported':
      return "This browser can't share a location."
    case 'insecure':
      return 'Location sharing needs a secure (https) page.'
    case 'denied':
      return 'Location access is off for this site. Allow it in your browser settings, then try again.'
    case 'timeout':
      return "Finding your location took too long. Move somewhere with a clearer signal and try again."
    default:
      return "Your location isn't available right now. Check that location services are on, then try again."
  }
}

/** How sure the fix is, in words: "Accurate to 12 m" / "to 1.4 km". */
export function accuracyText(m: number | null): string | null {
  if (m === null || !Number.isFinite(m) || m < 0) return null
  if (m < 1000) return `Accurate to ${Math.max(1, Math.round(m))} m`
  return `Accurate to ${(m / 1000).toFixed(1)} km`
}

/** A place line for the bubble when there is no label: "12.97160, 77.59460". */
export function coordsText(lat: number, lng: number): string {
  return `${roundCoord(lat).toFixed(5)}, ${roundCoord(lng).toFixed(5)}`
}
