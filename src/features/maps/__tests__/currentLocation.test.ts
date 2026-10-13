import { describe, expect, test } from "bun:test"
import { createLocationController, locationFresh, locationUsable, locationRequired, LOCATION_MAX_AGE_MS, LOCATION_REUSE_MAX_AGE_MS, type LocationSource } from "../locationController"
import { reverseResult } from "../reverseGeocode"
import { sameCurrentPin } from "../useCurrentAddress"

const point = { lat: 17.4401, lng: 78.3489 }
function fakeSource() {
  const calls: { success: PositionCallback; error?: PositionErrorCallback | null; options?: PositionOptions }[] = []
  const source: LocationSource = { getCurrentPosition(success, error, options) { calls.push({ success, error, options }) } }
  return { source, calls }
}
function fix(timestamp = 1_000, accuracy = 10): GeolocationPosition {
  return { timestamp, coords: { latitude: point.lat, longitude: point.lng, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) }, toJSON: () => ({}) }
}

describe("Required foreground location", () => {
  test("waits for permission and a fix; never invents a default point", () => {
    const c = createLocationController(() => 1_000), f = fakeSource()
    expect(c.snapshot().point).toBeNull()
    c.request(f.source)
    expect(c.snapshot().status).toBe("locating")
    expect(c.snapshot().point).toBeNull()
    expect(f.calls[0].options).toEqual({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 })
    f.calls[0].success(fix())
    expect(c.snapshot().point).toEqual(point)
    expect(locationFresh(c.snapshot(), 1_000)).toBe(true)
  })
  test("duplicates do not trigger duplicate browser requests", () => {
    const c = createLocationController(), f = fakeSource()
    c.request(f.source); c.request(f.source)
    expect(f.calls).toHaveLength(1)
  })
  for (const code of [1, 2, 3]) test(`refusal ${code} blocks instead of using an address or guessed city`, () => {
    const c = createLocationController(), f = fakeSource()
    c.request(f.source); f.calls[0].error?.({ code } as GeolocationPositionError)
    expect(c.snapshot().status).toBe("error")
    expect(c.snapshot().point).toBeNull()
    expect(c.snapshot().message).not.toBe("")
  })
  test("revocation/logout discards the fix and ignores late callbacks", () => {
    const c = createLocationController(() => 1_000), f = fakeSource()
    c.request(f.source); c.reset("Permission revoked")
    f.calls[0].success(fix())
    expect(c.snapshot().point).toBeNull()
    c.request(f.source); f.calls[1].success(fix())
    expect(c.snapshot().status).toBe("ready")
    c.reset()
    expect(locationFresh(c.snapshot())).toBe(false)
  })
  test("quiet refresh keeps the journey visible and deduplicates requests", () => {
    const c = createLocationController(() => 1_000), f = fakeSource()
    c.request(f.source); f.calls[0].success(fix()); c.request(f.source)
    expect(c.snapshot().point).toEqual(point)
    expect(c.snapshot().refreshing).toBe(true)
    expect(locationUsable(c.snapshot(), 1_000)).toBe(true)
    c.request(f.source)
    expect(f.calls).toHaveLength(2)
    f.calls[1].success(fix())
    expect(c.snapshot().refreshing).toBeFalsy()
  })
  test("navigating between route consumers reuses a fresh fix", () => {
    let now = 1_000
    const c = createLocationController(() => now), f = fakeSource()
    c.ensure(f.source); f.calls[0].success(fix())
    for (let i = 0; i < 5; i++) c.ensure(f.source)
    expect(f.calls).toHaveLength(1)
    now += LOCATION_MAX_AGE_MS
    c.ensure(f.source)
    expect(f.calls).toHaveLength(2)
    expect(c.snapshot().point).toEqual(point)
  })
  test("timeout can retain a recent fix, but never beyond the reuse limit", () => {
    let now = 1_000
    const c = createLocationController(() => now), f = fakeSource()
    c.request(f.source); f.calls[0].success(fix())
    now += LOCATION_MAX_AGE_MS
    c.ensure(f.source); f.calls[1].error?.({ code: 3 } as GeolocationPositionError)
    expect(c.snapshot().point).toEqual(point)
    expect(c.snapshot().message).toContain("too long")
    now = 1_000 + LOCATION_REUSE_MAX_AGE_MS
    expect(locationUsable(c.snapshot(), now)).toBe(false)
    c.ensure(f.source)
    expect(c.snapshot().point).toBeNull()
    f.calls[2].error?.({ code: 3 } as GeolocationPositionError)
    expect(c.snapshot().status).toBe("error")
  })
  test("revoking permission during a refresh immediately discards the cached fix", () => {
    const c = createLocationController(() => 1_000), f = fakeSource()
    c.request(f.source); f.calls[0].success(fix()); c.request(f.source)
    f.calls[1].error?.({ code: 1 } as GeolocationPositionError)
    expect(c.snapshot().point).toBeNull()
    expect(c.snapshot().status).toBe("error")
    f.calls[1].success(fix())
    expect(c.snapshot().point).toBeNull()
  })
  test("fixes expire and clocks cannot make future captures usable", () => {
    const c = createLocationController(() => 1_000), f = fakeSource()
    c.request(f.source); f.calls[0].success(fix())
    expect(locationFresh(c.snapshot(), 1_000 + LOCATION_MAX_AGE_MS)).toBe(false)
    expect(locationFresh(c.snapshot(), 999)).toBe(false)
  })
  for (const [age, accuracy] of [[70_000, 10], [0, 501], [0, NaN]]) test(`rejects stale or approximate fix ${age}/${accuracy}`, () => {
    const c = createLocationController(() => 100_000), f = fakeSource()
    c.request(f.source); f.calls[0].success(fix(100_000 - age, accuracy))
    expect(c.snapshot().status).toBe("error")
    expect(c.snapshot().point).toBeNull()
  })
  test("unsupported, insecure and synchronously refused requests fail safely", () => {
    const c = createLocationController()
    c.request(undefined); expect(c.snapshot().status).toBe("error")
    const f = fakeSource(); c.request(f.source, false); expect(f.calls).toHaveLength(0)
    c.request({ getCurrentPosition() { throw new Error("SecurityError") } }); expect(c.snapshot().status).toBe("error")
  })
  test("only new local-service discovery and transactions need location, not history or partner onboarding", () => {
    for (const path of ["/doorstep", "/doorstep/c/cleaning", "/doorstep/s/example/pros", "/doorstep/checkout"]) expect(locationRequired(path, "doorstep")).toBe(true)
    for (const path of ["/doorstep/partner", "/doorstep/bookings", "/doorstep/bookings/example", "/doorstep/outstanding"]) expect(locationRequired(path, "doorstep")).toBe(false)
    for (const path of ["/feast", "/feast/r/example", "/feast/cart", "/feast/checkout"]) expect(locationRequired(path, "feast")).toBe(true)
    for (const path of ["/feast/orders", "/feast/orders/example", "/feast/kitchen"]) expect(locationRequired(path, "feast")).toBe(false)
  })
  test("GPS jitter is tolerated, distant saved addresses are not", () => {
    expect(sameCurrentPin(point.lat, point.lng, point)).toBe(true)
    expect(sameCurrentPin(point.lat + 0.0001, point.lng, point)).toBe(true)
    expect(sameCurrentPin(point.lat + 0.001, point.lng, point)).toBe(false)
    expect(sameCurrentPin(null, point.lng, point)).toBe(false)
  })
})

describe("Automatic address lookup", () => {
  const components = [{ long_name: "Hyderabad", short_name: "Hyderabad", types: ["locality"] }, { long_name: "Telangana", short_name: "TS", types: ["administrative_area_level_1"] }, { long_name: "500001", short_name: "500001", types: ["postal_code"] }, { long_name: "India", short_name: "IN", types: ["country"] }]
  const result = { formatted_address: "Example street, Hyderabad", address_components: components, types: ["street_address"] }
  test("keeps the actual device pin, not a geocoded building centroid", () => {
    const address = reverseResult(point, [result])
    expect(address.lat).toBe(point.lat); expect(address.lng).toBe(point.lng)
    expect(address.postalCode).toBe("500001")
  })
  test("never guesses missing PIN codes, incomplete addresses, or unsupported countries", () => {
    expect(() => reverseResult(point, [])).toThrow()
    expect(() => reverseResult(point, [{ ...result, address_components: components.filter(c => !c.types.includes("postal_code")) }])).toThrow()
    expect(() => reverseResult(point, [{ ...result, address_components: components.map(c => c.types.includes("country") ? { ...c, short_name: "US" } : c) }])).toThrow()
    expect(() => reverseResult(point, [{ ...result, partial_match: true }])).toThrow()
  })
})
