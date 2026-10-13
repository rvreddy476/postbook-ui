import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { checkoutAddressIssue, resolveChosen } from "../model/address"
import type { Address } from "../model/wire"

const address: Address = { id: "saved-home", label: "Home", receiverName: "Test", phone: "9999999999", addressLine1: "Flat 2, Test street", addressLine2: null, landmark: null, city: "Hyderabad", state: "Telangana", postalCode: "500098", country: "India", latitude: 17.39, longitude: 78.60, isDefault: true }

describe("Food checkout delivery address", () => {
  it("can use an explicitly selected saved address without device location", () => {
    const manual = { ...address, id: "manual", isDefault: false }
    expect(resolveChosen([address, manual], "manual")).toBe(manual)
    expect(checkoutAddressIssue(manual)).toBeNull()
  })
  it("blocks missing or unpinned addresses with a manual option", () => {
    expect(checkoutAddressIssue(null)).toContain("manually")
    expect(checkoutAddressIssue({ ...address, latitude: null })).toContain("manual search")
    expect(checkoutAddressIssue({ ...address, latitude: Number.NaN })).not.toBeNull()
  })
  it("checkout uses the saved-address flow and never forces automatic GPS lookup", () => {
    const source = readFileSync(new URL("../screens/CheckoutScreen.tsx", import.meta.url), "utf8")
    expect(source).toContain("useChosenAddress()")
    expect(source).toContain("<AddAddress")
    expect(source).toContain("address.receiverName, address.phone")
    expect(source).not.toContain("useCurrentAddress")
    expect(source).toContain("address_id: chosen.id")
  })
})
