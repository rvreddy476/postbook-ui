import { describe, expect, it } from "bun:test"
import {
  EMPTY_ADDRESS_FORM,
  addressToForm,
  formatAddressLine,
  isAddressValid,
  normalisePhone,
  toAddressRequest,
  toAddresses,
  validateAddress,
  type AddressFormValues,
} from "../model/addresses"

// The form's six rules, the wire round trip, and the default-first order.

const filled: AddressFormValues = {
  contactName: "Raghu V",
  phone: "98765 43210",
  line1: "12, MG Road",
  line2: "",
  landmark: "Opp. the park",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500001",
  type: "home",
  isDefault: true,
}

describe("validateAddress", () => {
  it("accepts a complete address", () => {
    expect(validateAddress(filled)).toEqual({})
    expect(isAddressValid(filled)).toBe(true)
  })

  it("names every missing required field and not the optional ones", () => {
    const errors = validateAddress(EMPTY_ADDRESS_FORM)
    expect(Object.keys(errors).sort()).toEqual(["city", "contactName", "line1", "phone", "pincode", "state"])
    expect("line2" in errors).toBe(false)
    expect("landmark" in errors).toBe(false)
  })

  it("wants a 10-digit Indian mobile number", () => {
    expect(validateAddress({ ...filled, phone: "12345" }).phone).toBe("Enter a 10-digit Indian mobile number.")
    expect(validateAddress({ ...filled, phone: "1234567890" }).phone).toBe("Enter a 10-digit Indian mobile number.")
    expect(validateAddress({ ...filled, phone: "98765432101" }).phone).toBe("Enter a 10-digit Indian mobile number.")
    expect(validateAddress({ ...filled, phone: "987654321" }).phone).toBe("Enter a 10-digit Indian mobile number.")
    expect(validateAddress({ ...filled, phone: "+91 98765-43210" }).phone).toBeUndefined()
    expect(validateAddress({ ...filled, phone: "098765 43210" }).phone).toBeUndefined()
    expect(normalisePhone("+91 98765-43210")).toBe("9876543210")
  })

  it("wants a 6-digit PIN code that does not start with 0", () => {
    expect(validateAddress({ ...filled, pincode: "50001" }).pincode).toBe("Enter a 6-digit PIN code.")
    expect(validateAddress({ ...filled, pincode: "050001" }).pincode).toBe("Enter a 6-digit PIN code.")
    expect(validateAddress({ ...filled, pincode: "500 001" }).pincode).toBeUndefined()
  })

  it("treats whitespace as empty", () => {
    expect(validateAddress({ ...filled, contactName: "   " }).contactName).toBeDefined()
    expect(validateAddress({ ...filled, line1: " " }).line1).toBeDefined()
    expect(validateAddress({ ...filled, city: "\t" }).city).toBeDefined()
    expect(validateAddress({ ...filled, state: "" }).state).toBeDefined()
  })
})

describe("wire", () => {
  it("sends the handler's names, trimmed and normalised, with the optional lines only when set", () => {
    expect(toAddressRequest(filled)).toEqual({
      contact_name: "Raghu V",
      phone: "9876543210",
      address_line_1: "12, MG Road",
      landmark: "Opp. the park",
      city: "Hyderabad",
      state: "Telangana",
      postal_code: "500001",
      country: "IN",
      address_type: "home",
      is_default: true,
    })
    expect("address_line_2" in toAddressRequest(filled)).toBe(false)
    expect(toAddressRequest({ ...filled, line2: " Flat 4 " }).address_line_2).toBe("Flat 4")
  })

  it("reads what GET /addresses sends, default first, Go's absent is_default as false", () => {
    const list = toAddresses([
      { id: "a", contact_name: "A", phone: "9", address_line_1: "1", city: "c", state: "s", postal_code: "500001" },
      { id: "b", contact_name: "B", phone: "9", address_line_1: "2", city: "c", state: "s", postal_code: "500002", is_default: true, address_type: "work" },
      { contact_name: "no id" },
    ])
    expect(list.map((a) => a.id)).toEqual(["b", "a"])
    expect(list[0].isDefault).toBe(true)
    expect(list[0].type).toBe("work")
    expect(list[1].isDefault).toBe(false)
    expect(list[1].type).toBe("home")
    expect(list[1].country).toBe("IN")
  })

  it("puts a saved address back into the form and formats the one-line summary", () => {
    const address = toAddresses([{ id: "a", contact_name: "A", phone: "9876543210", address_line_1: "12, MG Road", address_line_2: "", landmark: "Opp. the park", city: "Hyderabad", state: "Telangana", postal_code: "500001" }])[0]
    expect(addressToForm(address)).toEqual({ ...filled, contactName: "A", phone: "9876543210", isDefault: false })
    expect(formatAddressLine(address)).toBe("12, MG Road, Opp. the park, Hyderabad, Telangana, 500001")
    expect(addressToForm(null)).toEqual(EMPTY_ADDRESS_FORM)
  })
})
