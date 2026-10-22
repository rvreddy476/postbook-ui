import { describe, expect, test } from 'bun:test'

import { decodeMessageExtras } from '../contract'
import { rowPreview } from '../inbox'
import { decodeInboxRow } from '../contract'
import {
  LOCATION_PLACE_MAX,
  accuracyText,
  capPlaceText,
  decodeLocation,
  geoProblemOf,
  geoProblemText,
  googleStaticMapUrl,
  locationMessageBody,
  mapsUrl,
  osmTile,
  roundCoord,
  validCoords,
} from '../location'
import { bubbleKind, isBareBubble } from '../../../components/messenger/thread/threadModel'

// Founder, 23 Oct 2026: "location sharing".
describe('shared location', () => {
  test('the send body is rounded to 5 decimals and capped', () => {
    const body = locationMessageBody({ lat: 12.9715987, lng: 77.5945627, accuracyM: 12.4, label: '  Cubbon Park ', address: null })
    expect(body).toEqual({ type: 'location', location: { lat: 12.9716, lng: 77.59456, accuracy_m: 12, label: 'Cubbon Park' } })
    const long = locationMessageBody({ lat: 1, lng: 1, accuracyM: null, label: 'é'.repeat(LOCATION_PLACE_MAX + 5), address: 'a\nb' })
    const loc = long.location as Record<string, unknown>
    expect(Array.from(loc.label as string).length).toBe(LOCATION_PLACE_MAX)
    expect(loc.address).toBe('a b')
    expect('accuracy_m' in loc).toBe(false)
    expect(roundCoord(-0.000001)).toBe(0)
    expect(Object.is(roundCoord(-0.000001), -0)).toBe(false)
  })

  test('decoding is tolerant and refuses impossible places', () => {
    expect(decodeLocation({ lat: 12.9716, lng: 77.59456, label: 'Park', address: '' })).toEqual({
      lat: 12.9716, lng: 77.59456, accuracyM: null, label: 'Park', address: null,
    })
    expect(decodeLocation({ lat: 91, lng: 1 })).toBeNull()
    expect(decodeLocation({ lat: '12', lng: 1 })).toBeNull()
    expect(decodeLocation(null)).toBeNull()
    expect(validCoords(0, 0)).toBe(true)
    expect(validCoords(Number.NaN, 0)).toBe(false)
  })

  test('a location message draws the location bubble, bare', () => {
    const extras = decodeMessageExtras({ type: 'location', location: { lat: 1, lng: 2 } })
    expect(extras.location).toEqual({ lat: 1, lng: 2, accuracyM: null, label: null, address: null })
    const msg = { id: 'm', senderId: 'a', type: 'location', text: '', isDeleted: false, extras } as unknown as Parameters<typeof bubbleKind>[0]
    expect(bubbleKind(msg)).toBe('location')
    expect(isBareBubble('location')).toBe(true)
    // Without a decodable place it is just a (blank) text bubble, never a crash.
    const broken = { ...msg, extras: decodeMessageExtras({ type: 'location' }) } as typeof msg
    expect(bubbleKind(broken)).toBe('text')
  })

  test('the inbox row previews a location without the place', () => {
    const row = decodeInboxRow({ id: 'c', type: 'direct', last_message: { type: 'location', sender_id: 'them' } }, 'me')!
    expect(rowPreview(row, 'me').text).toContain('📍 Location')
  })

  test('Open in Maps and the map images', () => {
    expect(mapsUrl(12.9715987, 77.5945627)).toBe('https://www.google.com/maps/search/?api=1&query=12.9716,77.59456')
    expect(googleStaticMapUrl(1, 2, null)).toBeNull()
    const g = googleStaticMapUrl(1.000004, 2, 'browser-key')!
    expect(g.startsWith('https://maps.googleapis.com/maps/api/staticmap?')).toBe(true)
    expect(new URL(g).searchParams.get('center')).toBe('1,2')
    // Bengaluru at z15: the well-known tile and a point inside it.
    const t = osmTile(12.9716, 77.5946, 15)
    expect(t.url).toBe(`https://tile.openstreetmap.org/15/${t.x}/${t.y}.png`)
    expect(t.x).toBe(23446)
    expect(t.y).toBe(15193) // y = floor((1 - asinh(tan φ)/π) / 2 · 2^15) = floor(15193.25)
    expect(t.offsetX).toBeGreaterThanOrEqual(0)
    expect(t.offsetX).toBeLessThanOrEqual(256)
    expect(osmTile(0, 0, 1)).toMatchObject({ x: 1, y: 1, offsetX: 0, offsetY: 0 })
  })

  test('geolocation problems read as plain words', () => {
    expect(geoProblemOf(1)).toBe('denied')
    expect(geoProblemOf(2)).toBe('unavailable')
    expect(geoProblemOf(3)).toBe('timeout')
    expect(geoProblemText('denied')).toContain('browser settings')
    expect(accuracyText(12.4)).toBe('Accurate to 12 m')
    expect(accuracyText(1400)).toBe('Accurate to 1.4 km')
    expect(accuracyText(null)).toBeNull()
    expect(capPlaceText('  x  ')).toBe('x')
  })
})
