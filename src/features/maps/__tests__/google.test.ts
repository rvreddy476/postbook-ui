import { describe, expect, test } from "bun:test"
import { selectedPlace, tokenHex, validPoint, loadGoogleMaps } from "../google"

describe("Google location safeguards", () => {
  test("rejects corrupt points without coercing strings or nulls", () => {
    for (const value of [null, {}, { lat: "17", lng: 78 }, { lat: NaN, lng: 78 }, { lat: 17, lng: Infinity }, { lat: 91, lng: 78 }, { lat: 17, lng: -181 }]) expect(validPoint(value)).toBe(false)
    expect(validPoint({ lat: 17.4401, lng: 78.3489 })).toBe(true)
    expect(validPoint({ lat: 0, lng: 0 })).toBe(true)
  })
  test("extracts the new Places API fields and safely leaves absent fields empty", () => {
    const p = selectedPlace({ location: { lat: () => 17.4, lng: () => 78.3 }, formattedAddress: "Example, Hyderabad", addressComponents: [{ longText: "Hyderabad", types: ["locality"] }, { longText: "Telangana", types: ["administrative_area_level_1"] }, { longText: "500001", types: ["postal_code"] }] })
    expect(p).toEqual({ lat: 17.4, lng: 78.3, address: "Example, Hyderabad", city: "Hyderabad", state: "Telangana", postalCode: "500001", locality: "Hyderabad" })
    expect(selectedPlace({})).toBeNull()
    expect(selectedPlace({ location: { lat: () => NaN, lng: () => 78 } })).toBeNull()
    expect(selectedPlace({ location: { lat: () => 17, lng: () => 78 } })?.postalCode).toBe("")
  })
  test("uses theme tokens instead of a duplicate map palette", () => {
    expect(tokenHex(" 10 20 30 ")).toBe("#0a141e")
    expect(tokenHex("10,20,30")).toBe("#0a141e")
    for (const raw of ["", "NaN 1 2", "256 1 2", "-1 1 2"]) expect(() => tokenHex(raw)).toThrow()
  })
  test("does not load maps during server rendering", async () => {
    if (typeof window === "undefined") await expect(loadGoogleMaps()).rejects.toThrow("browser only")
  })
})
