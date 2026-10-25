'use client'

import { useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'

import {
  coordsText,
  googleStaticMapUrl,
  mapsBrowserKey,
  mapsUrl,
  osmTile,
  type ChatLocation,
} from '@/lib/chat/location'

/*
  The map picture for a shared location (23 Oct 2026). Google Static Maps
  when this build has a browser Maps key; otherwise four OpenStreetMap tiles
  around the point (no key, attributed "© OpenStreetMap"); and when neither
  loads, a plain pin card. Never a third-party script.
*/

// The preview's box: w-60 × h-36 (240 × 144 px). The tile maths needs the
// numbers; the classes below are the same values from the spacing scale.
const BOX_W = 240
const BOX_H = 144
const TILE = 256
const OSM_TILES = 4

type Source = 'google' | 'osm'

export function LocationMap({ location, className = '' }: { location: ChatLocation; className?: string }) {
  const googleUrl = googleStaticMapUrl(location.lat, location.lng, mapsBrowserKey(), { w: BOX_W, h: BOX_H })
  const [source, setSource] = useState<Source>(googleUrl ? 'google' : 'osm')
  const [failedTiles, setFailedTiles] = useState(0)

  if (source === 'osm' && failedTiles >= OSM_TILES) {
    return (
      <span className={`flex h-36 w-60 flex-col items-center justify-center gap-1 bg-primary-tint text-primary-ink ${className}`}>
        <MapPin className="h-8 w-8" aria-hidden />
        <span className="text-2xs font-medium tabular-nums">{coordsText(location.lat, location.lng)}</span>
      </span>
    )
  }

  if (source === 'google' && googleUrl) {
    return (
      <span className={`relative block h-36 w-60 overflow-hidden bg-brand-secondary ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={googleUrl}
          alt="Map of the shared location"
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setSource('osm')}
        />
      </span>
    )
  }

  // OSM: the tile holding the point plus its neighbours toward the point's
  // nearer edges, so a 240 × 144 window centred on the point is always covered.
  const t = osmTile(location.lat, location.lng)
  const x0 = t.offsetX < TILE / 2 ? t.x - 1 : t.x
  const y0 = t.offsetY < TILE / 2 ? t.y - 1 : t.y
  const pointX = (t.x - x0) * TILE + t.offsetX
  const pointY = (t.y - y0) * TILE + t.offsetY
  const tiles = [0, 1].flatMap((dy) => [0, 1].map((dx) => ({ x: x0 + dx, y: y0 + dy, dx, dy })))
  const zoomPart = t.url.split('/').slice(-3)[0]

  return (
    <span className={`relative block h-36 w-60 overflow-hidden bg-brand-secondary ${className}`}>
      <span
        className="absolute block"
        style={{ left: BOX_W / 2 - pointX, top: BOX_H / 2 - pointY, width: TILE * 2, height: TILE * 2 }}
        aria-hidden
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tile.x}-${tile.y}`}
            src={`https://tile.openstreetmap.org/${zoomPart}/${tile.x}/${tile.y}.png`}
            alt=""
            width={TILE}
            height={TILE}
            loading="lazy"
            className="absolute max-w-none"
            style={{ left: tile.dx * TILE, top: tile.dy * TILE }}
            onError={() => setFailedTiles((n) => n + 1)}
          />
        ))}
      </span>
      <MapPin
        className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-full fill-danger text-brand-card drop-shadow"
        aria-label="Shared location"
      />
      <span className="absolute bottom-0 right-0 bg-brand-card/80 px-1 text-2xs text-brand-text/70">© OpenStreetMap</span>
    </span>
  )
}

/** The chat bubble: map, place name / address, "Open in Maps". */
export function LocationBubble({ location }: { location: ChatLocation }) {
  const title = location.label ?? (location.address ? null : 'Location')
  return (
    <span className="block w-60 overflow-hidden rounded-2xl border border-brand-divider bg-brand-card text-brand-text">
      <a href={mapsUrl(location.lat, location.lng)} target="_blank" rel="noopener noreferrer" aria-label="Open the location in Maps" className="block">
        <LocationMap location={location} />
      </a>
      <span className="block px-3 pb-2.5 pt-2">
        {title && <span className="block truncate text-sm font-semibold">{title}</span>}
        {location.address && <span className="block text-xs text-brand-text/70">{location.address}</span>}
        <a
          href={mapsUrl(location.lat, location.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-ink no-underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open in Maps
        </a>
      </span>
    </span>
  )
}
