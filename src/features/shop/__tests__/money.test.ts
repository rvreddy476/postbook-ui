import { describe, expect, it } from "bun:test"
import { discountPercent, formatMinor, inrMinor, parseMinor } from "../money"

// The whole shop speaks integer paise. These pin the three things that go wrong
// with money on the web: a float multiply losing a paisa, Western grouping on
// an Indian amount, and an unreadable total rendering as ₹0.

describe("inrMinor", () => {
  it("renders whole rupees without paise", () => {
    expect(inrMinor(129900)).toBe("₹1,299")
    expect(inrMinor(0)).toBe("₹0")
  })
  it("renders paise when there are any", () => {
    expect(inrMinor(1299)).toBe("₹12.99")
    expect(inrMinor(1)).toBe("₹0.01")
    expect(inrMinor(74990)).toBe("₹749.90")
  })
  it("groups in the Indian style", () => {
    expect(inrMinor(1234567890)).toBe("₹1,23,45,678.90")
    expect(inrMinor(799700)).toBe("₹7,997")
  })
  it("never loses a paisa to float arithmetic", () => {
    expect(inrMinor(123456)).toBe("₹1,234.56")
    expect(inrMinor(1000000000000)).toBe("₹10,00,00,00,000")
  })
  it("carries a negative sign", () => {
    expect(inrMinor(-525)).toBe("−₹5.25")
  })
  it("says nothing rather than ₹0 for a value it cannot read", () => {
    expect(inrMinor(Number.NaN)).toBe("—")
    expect(inrMinor(undefined)).toBe("—")
    expect(inrMinor(null)).toBe("—")
  })
})

describe("formatMinor", () => {
  it("is the plain input text", () => {
    expect(formatMinor(123450)).toBe("1234.50")
    expect(formatMinor(-5)).toBe("-0.05")
    expect(formatMinor(null)).toBe("")
  })
})

describe("parseMinor", () => {
  it("reads what a person types", () => {
    expect(parseMinor("1,299")).toBe(129900)
    expect(parseMinor("₹ 1,23,456.50")).toBe(12345650)
    expect(parseMinor("Rs. 12.9")).toBe(1290)
    expect(parseMinor(" -5 ")).toBe(-500)
    expect(parseMinor(12.34)).toBe(1234)
  })
  it("refuses rather than rounds", () => {
    expect(parseMinor("12.345")).toBeNull()
    expect(parseMinor("1e3")).toBeNull()
    expect(parseMinor(".")).toBeNull()
    expect(parseMinor("1,,2")).toBeNull()
    expect(parseMinor("")).toBeNull()
    expect(parseMinor(0.1 + 0.2)).toBeNull()
  })
})

describe("discountPercent", () => {
  it("is the whole-percent saving, or nothing", () => {
    expect(discountPercent(199900, 149900)).toBe(25)
    expect(discountPercent(100000, 99999)).toBe(0)
    expect(discountPercent(100000, 100000)).toBeNull()
    expect(discountPercent(undefined, 100)).toBeNull()
    expect(discountPercent(50, 100)).toBeNull()
  })
})
